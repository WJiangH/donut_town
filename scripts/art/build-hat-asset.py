"""Bake a small directional atlas from the generated transparent master; Pillow runs locally."""
from pathlib import Path
import hashlib,io,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'art-source/accessories/felt-hat-v1.png'
im=Image.open(source).convert('RGBA')
assert im.width%3==0
cell=im.width//3
atlas=Image.new('RGBA',(480,112))
frames={};bounds={}
for i,name in enumerate(['front','side','back']):
 crop=im.crop((i*cell,0,(i+1)*cell,im.height))
 box=crop.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
 assert box
 sprite=crop.crop(box);sprite.thumbnail((156,108),Image.Resampling.NEAREST)
 x=i*160+(160-sprite.width)//2;y=112-sprite.height-2
 atlas.paste(sprite,(x,y));frames[name]=[x,y,sprite.width,sprite.height];bounds[name]=list(box)
buffer=io.BytesIO();atlas.save(buffer,format='PNG',optimize=True)
data=buffer.getvalue();assert len(data)<65536
sha=hashlib.sha256(data).hexdigest();url=f'/assets/accessories/felt-hat-{sha[:12]}.png'
(ROOT/url[1:]).write_bytes(data)
manifest={'url':url,'width':atlas.width,'height':atlas.height,'frames':frames,'bytes':len(data),'sha256':sha,'source':'art-source/accessories/felt-hat-v1.png','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceBounds':bounds,'generator':'built-in imagegen; transparent-background extraction follow-up','prompt':'Three directional views of a charcoal-brown felt trilby; fine RPG sprite detail matching r-7f3a2c, brown ribbon, curved brim, upper-left light. Isolated hats only, front/right/back, transparent alpha. Preserve the character.'}
(ROOT/'assets/accessories/felt-hat-v1.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'bytes':len(data),'frames':frames}))
