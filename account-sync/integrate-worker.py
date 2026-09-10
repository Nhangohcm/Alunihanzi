"""Generate a staging Worker copy; never overwrite the supplied Worker."""
from pathlib import Path
import argparse, shutil
parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
a=parser.parse_args()
if a.output.exists():raise SystemExit('Output exists: choose a fresh directory')
s=a.source.read_text()
anchor="    if (url.pathname.startsWith('/student/')) {"
if s.count(anchor)!=1 or 'async function getBearerPayload' not in s:raise SystemExit('Worker layout differs: review integration manually')
if 'savedLibraryRoute' in s:raise SystemExit('Already integrated')
s="import { savedLibraryRoute } from './saved-library.mjs';\n"+s.replace(anchor,"    const savedResponse=await savedLibraryRoute(req,env,{getBearerPayload,headers});\n    if(savedResponse)return savedResponse;\n"+anchor)
a.output.mkdir(parents=True)
(a.output/'index.js').write_text(s)
shutil.copyfile(Path(__file__).with_name('worker-module.mjs'),a.output/'saved-library.mjs')
print('Prepared staging source at',a.output)
