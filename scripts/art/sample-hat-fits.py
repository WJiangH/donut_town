"""Measure six seeded sample rigs for a local visual fitting review, not production approval."""
import hashlib,json,statistics,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
selection=json.loads((Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'prototypes/hat-fit-sample.json').read_text())
ids=selection.get('ids') or [item['id'] for item in selection['items']]
prior={item['id']:item for item in selection.get('items',[])}
items=[]
for id in ids:
 manifest=ROOT/f'characters/{id}.json';ch=json.loads(manifest.read_text());heads={};hashes={}
 for kind,source in [('walk',ch),*ch.get('actions',{}).items()]:
  path=ROOT/source['url'][1:];hashes[source['url']]=hashlib.sha256(path.read_bytes()).hexdigest()
  im=Image.open(path).convert('RGBA');points=[]
  for x,y,w,h in source['frames']:
   alpha=im.crop((x,y,x+w,y+h)).getchannel('A');rows=[]
   # Hair/temple band, ignoring scattered transparent-edge pixels and narrow props.
   for row in range(max(1,int(source['frameHeight']*.055)),min(h,int(source['frameHeight']*.21))):
    runs=[];start=None
    for col in range(w+1):
     on=col<w and alpha.getpixel((col,row))>160
     if on and start is None:start=col
     if not on and start is not None:runs.append((start,col));start=None
    if runs:
     a,b=max(runs,key=lambda p:p[1]-p[0]);rows.append((b-a,(a+b)/2))
   if not rows:raise ValueError(id)
   wide=sorted(rows,reverse=True)[:max(1,len(rows)//2)]
   width=round(statistics.median(p[0] for p in wide));cx=round(statistics.median(p[1] for p in wide))
   top=next((r for r in range(h) if any(alpha.getpixel((c,r))>160 for c in range(max(0,cx-width//4),min(w,cx+width//4)))),0)
   points.append([x+cx,y+top,width])
  if kind=='walk':
   for row in range(3):
    width=round(statistics.median(p[2] for p in points[row*3:row*3+3]))
    for p in points[row*3:row*3+3]:p[2]=width
  heads[kind]=points
 items.append({**{k:v for k,v in prior.get(id,{}).items() if k in ['fitStatus','note']},'id':id,'label':f'Resident {len(items)+1}','heads':heads,'sourceHashes':hashes})
output={'seed':selection['seed'],'selection':'random.sample of sorted nine-frame personalized rigs, excluding r-7f3a2c','status':selection.get('status','local visual sample only'),'items':items}
(ROOT/'prototypes/hat-fit-sample.json').write_text(json.dumps(output,indent=2)+'\n')
print([(i['id'],i['heads']['walk'][1]) for i in items])
