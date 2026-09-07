#!/usr/bin/env python3
"""Bake locally with Pillow; Render serves the resulting PNGs without processing."""
import hashlib,io,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
catalog_path=ROOT/'content/shop.json'
catalog=json.loads(catalog_path.read_text())
manifest=json.loads((ROOT/'content/shop-art-manifest.json').read_text())
receipts={entry['id']:entry for entry in manifest['assets']}
summary=[]
previous_outputs={output['file'] for receipt in receipts.values() for output in receipt.get('outputs',{}).values()}
for item in catalog['items']:
    if item['kind']=='pet': continue
    receipt=receipts.setdefault(item['id'],{'id':item['id'],'subject':item['name']})
    source=ROOT/receipt.get('source',f"art-source/shop/{item['id']}-v1.png")
    im=Image.open(source).convert('RGBA')
    # The render frame excludes only near-transparent export noise.
    alpha=im.getchannel('A');box=alpha.point(lambda a:255 if a>8 else 0).getbbox()
    if not box: raise ValueError(f"Empty sprite: {item['id']}")
    sprite=im.crop(box)
    outputs={}
    for label,maximum,budget in [('art',256,131072),('thumb',96,32768)]:
        scaled=sprite.copy();scaled.thumbnail((maximum,maximum),Image.Resampling.NEAREST)
        # Two transparent pixels prevent edge clipping and keep validator corners clear.
        canvas=Image.new('RGBA',(scaled.width+4,scaled.height+4));canvas.paste(scaled,(2,2))
        buffer=io.BytesIO();canvas.save(buffer,format='PNG',optimize=True,compress_level=9)
        data=buffer.getvalue()
        if len(data)>budget: raise ValueError(f"{item['id']} exceeds {label} byte budget")
        digest=hashlib.sha256(data).hexdigest()
        url=f"/assets/shop/{item['id']}-{label}-{digest[:12]}.png"
        (ROOT/url.lstrip('/')).write_bytes(data);item[label]=url
        outputs[label]={'file':url,'sha256':digest,'bytes':len(data),'width':canvas.width,'height':canvas.height}
        if label=='art':item['artFrame']={'x':2,'y':2,'w':scaled.width,'h':scaled.height,'canvasW':canvas.width,'canvasH':canvas.height}
    receipt.update(file=item['art'],sha256=outputs['art']['sha256'],frame=item['artFrame'],source=source.relative_to(ROOT).as_posix(),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),outputs=outputs)
    summary.append((item['id'],outputs['art']['bytes']+outputs['thumb']['bytes']))
catalog_path.write_text(json.dumps(catalog,indent=2)+'\n')
manifest.update(version=2,assets=[receipts[item['id']] for item in catalog['items'] if item['kind']!='pet'],runtime={'artMaxSide':260,'thumbMaxSide':100,'resampling':'nearest','transparentPadding':2,'artByteBudget':131072,'thumbByteBudget':32768})
(ROOT/'content/shop-art-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Retire only outputs recorded by the previous manifest, after a successful bake.
current_outputs={output['file'] for receipt in manifest['assets'] for output in receipt['outputs'].values()}
for obsolete in previous_outputs-current_outputs:
    path=(ROOT/obsolete.lstrip('/')).resolve()
    if path.parent==ROOT/'assets/shop':path.unlink(missing_ok=True)
print(json.dumps({'items':len(summary),'runtimeBytes':sum(v for _,v in summary),'sourceBytes':sum(p.stat().st_size for p in (ROOT/'art-source/shop').glob('*.png'))}))
