"""Full ElectrumX service ENOSPC and replay of captured real Core blocks.

Capture on Windows using --capture --core --source-node --output. Replay in
the qualified Linux image with /bounded a 32 MiB tmpfs, /evidence writable and
the captured --fixture. The RPC replay is labelled; Core validated the fixture.
"""
import argparse
import errno
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

from nito_qa_runtime import Runtime, ROOT, PREFIX, electrum, free_port, wait_for


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--capture',action='store_true')
    p.add_argument('--core')
    p.add_argument('--source-node',type=Path)
    p.add_argument('--output',type=Path)
    p.add_argument('--fixture',type=Path)
    a=p.parse_args()
    if a.capture:
        with Runtime(a.core,a.output,source_node=a.source_node) as r:
            blocks=[r.rpc('getblock',r.rpc('getblockhash',h),0) for h in range(r.rpc('getblockcount')+1)]
            hashes=[r.rpc('getblockhash',h) for h in range(len(blocks))]
            (r.output/'fixture.json').write_text(json.dumps({'blocks':blocks,'hashes':hashes,
                'networkinfo':r.rpc('getnetworkinfo'),'pools':r.rpc('getorchardpools')})+'\n')
        return
    root=Path('/bounded')
    stat=os.statvfs(root)
    assert stat.f_blocks*stat.f_frsize <= 64*1024*1024
    fixture=json.loads(a.fixture.read_text()); hashes=fixture['hashes']; blocks=dict(zip(hashes,fixture['blocks']))
    height=1
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            request=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            def answer(q):
                m,params=q['method'],q.get('params',[])
                result={'getblockcount':lambda:height,'getblockhash':lambda:hashes[params[0]],
                    'getblock':lambda:blocks[params[0]],'getrawmempool':lambda:[],
                    'getnetworkinfo':lambda:fixture['networkinfo'],
                    'getblockchaininfo':lambda:{
                        'blocks':height,
                        'privateTxActivationHeight':fixture['pools']['privateTxActivationHeight'],
                        'activated':fixture['pools']['activated']},
                    'getorchardpools':lambda:fixture['pools']}[m]()
                return {'jsonrpc':'2.0','id':q['id'],'result':result,'error':None}
            response=[answer(q) for q in request] if isinstance(request,list) else answer(request)
            data=json.dumps(response).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    rpc,tcp,admin=free_port(),free_port(),free_port()
    http=ThreadingHTTPServer(('127.0.0.1',rpc),Handler)
    thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
    processes=[];logs=[]
    def launch(name,db):
        db.mkdir(exist_ok=True)
        log=open(Path('/evidence')/(name+'.log'),'w');logs.append(log)
        env=dict(os.environ,COIN='Nito',NET='regtest',DB_DIRECTORY=str(db),DB_ENGINE='leveldb',
            DAEMON_URL=f'http://qa:qa@127.0.0.1:{rpc}',SERVICES=f'tcp://127.0.0.1:{tcp},rpc://127.0.0.1:{admin}',
            ALLOW_ROOT='1',PEER_DISCOVERY='OFF',PEER_ANNOUNCE='',ANON_LOGS='1',CACHE_MB='16',
            LOG_FORMAT='%(levelname)s:%(name)s:%(message)s',DAEMON_POLL_INTERVAL_BLOCKS='100')
        proc=subprocess.Popen([sys.executable,'-m','electrumx.cli.electrumx_server'],env=env,stdout=log,stderr=subprocess.STDOUT)
        processes.append(proc);return proc
    def synced():
        if processes and processes[-1].poll() is not None:
            raise RuntimeError('service exited; inspect log')
        state=electrum(tcp,PREFIX+'get_state')
        return state if state['height']==height else None
    def snapshot():
        state=wait_for(synced)
        start=state.get('activation_height',0)
        return {'state':state,'page':electrum(tcp,PREFIX+'get_compact_range',start,1000),
                'witness':electrum(tcp,PREFIX+'get_witness',0)}
    report={'scope':'full Linux ElectrumX against replay of real Core-validated blocks',
            'height':len(hashes)-1,'volume_bytes':stat.f_blocks*stat.f_frsize}
    try:
        db=root/'interrupted'
        proc=launch('disk-service-before',db);wait_for(synced)
        filler=root/'filler'
        with filler.open('wb',buffering=0) as f:
            try:
                while True:f.write(bytes(65536))
            except OSError as e:assert e.errno==errno.ENOSPC
        height=len(hashes)-1
        code=proc.wait(timeout=60)
        log=Path('/evidence/disk-service-before.log').read_text()
        assert 'No space left on device' in log,log[-3000:]
        report['failure_exit_code']=code
        assert code != 0, 'fatal storage failure must be visible to the supervisor'
        filler.unlink()
        proc=launch('disk-service-resumed',db);actual=snapshot()
        electrum(admin,'stop');proc.wait(timeout=30)
        proc=launch('disk-service-fresh',root/'fresh');expected=snapshot()
        assert actual==expected
        electrum(admin,'stop');proc.wait(timeout=30)
        report.update(result='passed',checks=['service exits after real metadata/DB ENOSPC',
            'reopen and replay recover exact compact history, state and real witness',
            'recovered index equals fresh index'],state=actual['state'])
    finally:
        for proc in processes:
            if proc.poll() is None:proc.terminate();proc.wait(timeout=30)
        http.shutdown();http.server_close();thread.join()
        for log in logs:log.close()
        Path('/evidence/disk-service-result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
