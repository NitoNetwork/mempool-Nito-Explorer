"""Real ENOSPC on a bounded Linux tmpfs; never fill the host filesystem.

Run in a qualified Linux image with --tmpfs /bounded:size=32m. The public
index shares LevelDB's transactional batch. Synthetic commitments are labelled
as such; this complements, rather than substitutes, full service replay tests.
"""
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import resource
import time

import plyvel
from electrumx.server import nito_orchard_index as index
from electrumx.server.nito_private import PrivateAction


def main():
    root=Path('/bounded')
    stats=os.statvfs(root)
    assert stats.f_blocks*stats.f_frsize <= 64*1024*1024, 'requires a bounded test volume'
    output=Path('/evidence/disk-full-result.json')
    report={'volume_bytes':stats.f_blocks*stats.f_frsize,'engine':'LevelDB','plyvel':plyvel.__version__,
            'rocksdb_installed':importlib.util.find_spec('rocksdb') is not None,
            'platform':platform.platform(),'scope':'synthetic public index + real native tree + LevelDB ENOSPC'}
    start=time.monotonic()
    db=plyvel.DB(str(root/'db'),create_if_missing=True)
    blocks=[(0,bytes(32),[])]
    for i in range(8192):
        height=i//64+1
        if height==len(blocks):blocks.append((height,height.to_bytes(32,'little'),[]))
        value=(i+1).to_bytes(32,'little')
        blocks[-1][2].append(PrivateAction(height,value,i%64+1,0,1,value,value,bytes(32),bytes(52),0,bytes(32)))
    with db.write_batch(transaction=True,sync=True) as batch:
        index.write_private_index(db,batch,blocks,[],128,'regtest',bytes(32).hex())
    state=index.read_state(db)
    witness=index.read_witness(db,4096)
    digest=lambda:hashlib.sha256(b''.join(k+v for k,v in db)).hexdigest()
    before=digest()
    # Close and reopen to prove a durable baseline before inducing the error.
    db.close();db=plyvel.DB(str(root/'db'),create_if_missing=False)
    filler=root/'filler'
    with filler.open('wb',buffering=0) as f:
        try:
            while True:f.write(bytes(65536))
        except OSError as e:
            assert e.errno==errno.ENOSPC
    try:
        with db.write_batch(transaction=True,sync=True) as batch:
            index.write_private_index(db,batch,[(129,(129).to_bytes(32,'little'),[])],[],129,'regtest',bytes(32).hex())
            batch.put(b'large-uncommitted-record',os.urandom(2*1024*1024))
    except plyvel.Error as error:
        report['write_error']=str(error)
        assert 'space' in str(error).lower(),str(error)
    else:
        raise AssertionError('expected ENOSPC')
    db.close()
    # Remove only the known disposable filler on the already bounded volume.
    filler.unlink()
    db=plyvel.DB(str(root/'db'),create_if_missing=False)
    assert index.read_state(db)==state
    assert index.read_witness(db,4096)==witness
    assert db.get(b'large-uncommitted-record') is None
    assert digest()==before
    with db.write_batch(transaction=True,sync=True) as batch:
        index.write_private_index(db,batch,[(129,(129).to_bytes(32,'little'),[])],[],129,'regtest',bytes(32).hex())
    assert index.read_state(db)['height']==129
    db.close()
    usage=resource.getrusage(resource.RUSAGE_SELF)
    report.update(result='passed',checks=['actual filesystem ENOSPC','failed checkpoint batch absent after reopen',
        'all committed records and real witness unchanged','index resumes after free space restored'],
        actions=8192,peak_rss_bytes=usage.ru_maxrss*1024,cpu_seconds=usage.ru_utime+usage.ru_stime,
        wall_seconds=time.monotonic()-start,includes_native_allocations=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
