"""Locally split the approved generated atlas using reviewed material regions.
No source photo, generative redraw, resizing, or frame realignment.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]
spec=json.loads((ROOT/'characters/wardrobe/r-7f3a2c.regions.json').read_text())
source=Image.open(ROOT/spec['source']).convert('RGBA')
width,height=source.size
out=ROOT/'assets/residents'/spec['characterId']/'wardrobe-v1'
out.mkdir(parents=True,exist_ok=True)
mask=Image.new('L',source.size);draw=ImageDraw.Draw(mask)
for points in spec['shoes']:draw.polygon([tuple(p) for p in points],fill=255)
shoeMask=mask
jacketMask=Image.new('L',source.size);draw=ImageDraw.Draw(jacketMask)
for x,y,w,h in spec['jackets']:draw.rectangle((x,y,x+w-1,y+h-1),fill=255)
for x,y,w,h in spec['jacketExclusions']:draw.rectangle((x,y,x+w-1,y+h-1),fill=0)
base=Image.new('RGBA',source.size);shoes=Image.new('RGBA',source.size);jacket=Image.new('RGBA',source.size)
# Keep skin, white shirt and cuffs in the fixed base. Material masks are exclusive.
for y in range(height):
 for x in range(width):
  pixel=source.getpixel((x,y));r,g,b,a=pixel
  target=shoes if shoeMask.getpixel((x,y)) else jacket if jacketMask.getpixel((x,y)) and max(r,g,b)-min(r,g,b)<28 and max(r,g,b)<155 else base
  target.putpixel((x,y),pixel)

def recolor(layer,color):
 result=layer.copy()
 for y in range(height):
  for x in range(width):
   r,g,b,a=layer.getpixel((x,y))
   if not a:continue
   value=max(r,g,b)
   if value<17:continue # Retain the darkest outline.
   # Preserve source shading and alpha; shape remains exactly the same.
   t=min(1,(value-12)/65)
   result.putpixel((x,y),tuple(round(c*(.3+.7*t)) for c in color)+(a,))
 return result
lenses=Image.new('RGBA',source.size);draw=ImageDraw.Draw(lenses)
for points in spec['lenses']:
 draw.polygon([tuple(p) for p in points],fill=(17,29,37,255))
 x,y=points[0];draw.line((x+3,y+2,x+8,y+2),fill=(69,91,100,255),width=2)
assets={'base':base,'shoes-original':shoes,'jacket-original':jacket,'shoes-cream':recolor(shoes,(211,202,176)),'shoes-burgundy':recolor(shoes,(117,47,53)),'jacket-navy':recolor(jacket,(42,73,108)),'jacket-olive':recolor(jacket,(80,91,54)),'eyewear-smoke':lenses}
for name,im in assets.items():im.save(out/(name+'.png'))
# Exact reconstruction is the gate for a reversible legacy split.
combined=Image.alpha_composite(Image.alpha_composite(base,jacket),shoes)
assert combined.tobytes()==source.tobytes(),'Original layers must reconstruct source byte-for-byte'
# Changed pixels must lie inside their approved material masks.
for name,original,allowed in [('shoes-cream',shoes,shoeMask),('shoes-burgundy',shoes,shoeMask),('jacket-navy',jacket,jacketMask),('jacket-olive',jacket,jacketMask)]:
 assert assets[name].getchannel('A').tobytes()==original.getchannel('A').tobytes()
 for y in range(height):
  for x in range(width):
   if assets[name].getpixel((x,y))!=original.getpixel((x,y)):assert allowed.getpixel((x,y))
manifest=json.loads((ROOT/'characters'/f"{spec['characterId']}.json").read_text())
prefix='/'+str(out.relative_to(ROOT))+'/'
manifest.update(schemaVersion=1,rig=spec['rig'],base=prefix+'base.png',slots={
 'jacket':{'required':True,'default':'original','items':{k:prefix+'jacket-'+k+'.png' for k in ['original','navy','olive']}},
 'shoes':{'required':True,'default':'original','items':{k:prefix+'shoes-'+k+'.png' for k in ['original','cream','burgundy']}},
 'eyewear':{'required':False,'default':'none','items':{'none':None,'smoke':prefix+'eyewear-smoke.png'}}},layerOrder=['jacket','shoes','eyewear'],compatibility='This rig only; same-silhouette apparel variants. Required garment slots cover legacy cutouts.')
(ROOT/'characters/wardrobe'/f"{spec['characterId']}.json").write_text(json.dumps(manifest,indent=2)+'\n')
print('PASS exact original reconstruction, fixed alpha and edits restricted to clothing/shoe masks. 8 PNG layers written.')
