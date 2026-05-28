import urllib.request
import urllib.parse
import re
import json

clients = [
    {"id": "0l1tgjwqDjYFKUPYgTFp", "name": "Ajuntament de Palamós", "nif": "P1712500F"},
    {"id": "1NRdF1MlZ2faioJWBHl0", "name": "Ajuntament de Roquetes", "nif": "P4313500C"},
    {"id": "6PTofLAhCdj35vHTr9JH", "name": "Escola Municipal de Música d'Ascó", "nif": "P4300037A"},
    {"id": "EDfZpjGHFheHwlCyJzNw", "name": "Ajuntament d'Ulldecona", "nif": "P4315800E"},
    {"id": "FVDYXx7FdFZD594us4Uc", "name": "Ajuntament de Gavà", "nif": "P0808800G"},
    {"id": "GCgNq2MsgSXYXUJu61QM", "name": "Ajuntament d'Ascó", "nif": "P4301900I"},
    {"id": "JfkEI7d4NvdDYjKhPth4", "name": "Ajuntament d'Amposta", "nif": "P4301400J"},
    {"id": "LIjNj6Ux6C7Nt2Pu8egd", "name": "Ajuntament de l'Ametlla de Mar", "nif": "P4301300B"},
    {"id": "TyXcmHXRmLmvD8tGAhKg", "name": "Ajuntament de Montferrer", "nif": "P2502800B"},
    {"id": "UyMp1iqJ4qRK95WczFxg", "name": "Ajuntament de la Sénia", "nif": "P430500D"},
    {"id": "V8E5ZQsyVKRsfIp4gwiD", "name": "Ajuntament de Paüls", "nif": "P4310400I"},
    {"id": "XlFzetyJUKl9MsZZJvWG", "name": "Institut Montserrat", "nif": "Q5855611I"},
    {"id": "YOYzdXbL9dCbNd14AZg9", "name": "Ajuntament de Sant Joan de Vilatorrada", "nif": "P0822500E"},
    {"id": "aYivK1fM80gKvsDTB8aj", "name": "Ajuntament d'Alcanar", "nif": "P4300400A"},
    {"id": "cWsAlMe8UUs160qgyVsK", "name": "Ajuntament de Montornes de Segarra", "nif": "P2518000A"},
    {"id": "esg6x7kKmLPV2D9yvCHG", "name": "Ajuntament de Tarragona / Escola de Música", "nif": "P4315000B"},
    {"id": "fh6DuGKCp0fj7P4IFAVY", "name": "Ajuntament del Mas de Barberans", "nif": "P4307800E"},
    {"id": "mthIxbGjxmRDiHmD6hzo", "name": "Ajuntament de Calaceit", "nif": "P4404900E"},
    {"id": "oYQ0pXvY5Xj02PAym2jo", "name": "Ajuntament de Vilanova del Camí", "nif": "P0830300J"},
    {"id": "sOQzCcDiSl6MU9rdjkzV", "name": "IEA Oriol Martorell", "nif": "50800005A"},
    {"id": "t81ILaGWUHNRogLYcXWd", "name": "Ajuntament de Torredembarra", "nif": "P4315500A"},
    {"id": "vf5zx9bfAgqN8v5NnWoi", "name": "Ajuntament de El Pinell de Brai", "nif": "P4310800J"},
    {"id": "xSJfePKde4WEBn4JiVkg", "name": "Ajuntament de Piera", "nif": "P0816000D"},
    {"id": "xk4IHgpga66dPNh7MPYJ", "name": "Generalitat de Catalunya", "nif": "S0811001G"}
]

found_codes = {}

for c in clients:
    query = urllib.parse.quote_plus(c['name'] + ' "DIR3"')
    url = f"https://html.duckduckgo.com/html/?q={query}"
    req = urllib.request.Request(
        url, 
        data=None, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36'}
    )
    try:
        response = urllib.request.urlopen(req)
        html = response.read().decode('utf-8')
        # match L01 followed by 6 digits (Town halls) or A/E followed by digits
        matches = re.findall(r'([L|A|E][0-9]{8})', html)
        if matches:
            from collections import Counter
            most_common = Counter(matches).most_common(1)[0][0]
            found_codes[c['id']] = most_common
            print(f"Found for {c['name']}: {most_common}")
        else:
            print(f"Not found for {c['name']}")
    except Exception as e:
        print(f"Error for {c['name']}: {e}")

with open('found_dir3.json', 'w') as f:
    json.dump(found_codes, f)
