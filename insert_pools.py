import subprocess, json

DB = 'mariadb -u root mempool_nito -e'

# Clear all pools
subprocess.run(f'{DB} "DELETE FROM pools;"', shell=True)
print('Cleared pools')

# Insert unknown pool
subprocess.run(f"""{DB} "INSERT INTO pools (id, unique_id, name, link, regexes, addresses, slug) VALUES (0, 0, 'Unknown', '', '[]', '[]', 'unknown');" """, shell=True)

pools = [
    (1, 'NitoPool', 'https://pool.nitopool.online/', '["Miningcore"]', '["1EGoSQExTDVdyZaNXFVguwKQfkNtaP2yFr"]', 'nitopool'),
    (2, 'minto.day', 'https://minto.day/', '["ckpool","minto.day"]', '["nito1qfaw6l9mn9r5t6pglvanuf9zja3t4r277hun5pm","nito1qytqv0c3wupyu7n7m8wagnr86fk06r6z0gc56nk","nito1qlvau3rwx6f4rvacqah4lw670hhyeqgl6kl3gzu"]', 'mintoday'),
    (3, 'zpool.ca', 'https://zpool.ca/', '["zpool.ca"]', '["nito1qcpw7ap0h6gstr2kv5h78535kc6j3n78uu7ghdp"]', 'zpoolca'),
    (4, 'Koinium', 'https://koinium.com/', '["koinium"]', '["1JjsLp55wfUZ7r2Rj9BSyAUasWUA7kHHzq"]', 'koinium'),
    (5, 'NitroPool', '', '["NitroPool"]', '["168h2xMi1YeZAE4p13BorJwFA5xSM8X2AN"]', 'nitropool'),
    (6, 'Mining4People', '', '["Mining4People"]', '["1Pzn54TLTchbusFbxjpx9jtUd79CVsdjcT"]', 'mining4people'),
    (7, 'Frogman Crypto', '', '["Frogman Crypto"]', '["1HYL3XcykpWVNy77ccsRv6NGJ5W7fSviPT"]', 'frogmancrypto'),
    (8, 'Solo - RMT Node (Umbrel)', '', '["Mined with RMT Node on Umbrel"]', '[]', 'solormtnodeumbrel'),
    (9, 'Solo - RMT Node (ZimaOS)', '', '["Mined with RMT Node on ZimaOS"]', '[]', 'solormtnodezimaos'),
    (10, 'Solo - RTS Node (Umbrel)', '', '["Mined with RTS Node on Umbrel"]', '[]', 'solortsnodeumbrel'),
    (11, 'Solo - RMT Node', '', '["Mined with RMT Node"]', '[]', 'solormtnode'),
]

for pid, name, link, regexes, addresses, slug in pools:
    sql = f"INSERT INTO pools (id, unique_id, name, link, regexes, addresses, slug) VALUES ({pid}, {pid}, '{name}', '{link}', '{regexes}', '{addresses}', '{slug}');"
    result = subprocess.run(f'mariadb -u root mempool_nito -e "{sql}"', shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'Error inserting {name}: {result.stderr}')
    else:
        print(f'Inserted: {name}')

# Also update state to force re-assignment of blocks to pools
subprocess.run(f"""{DB} "DELETE FROM state WHERE name='pools_json_sha';" """, shell=True)
subprocess.run(f"""{DB} "INSERT INTO state VALUES('pools_json_sha', NULL, 'nito-custom-v1');" """, shell=True)

# Verify
result = subprocess.run('mariadb -u root mempool_nito -N -e "SELECT id, name, slug FROM pools ORDER BY id;"', shell=True, capture_output=True, text=True)
print(f'\nDB pools:\n{result.stdout}')
