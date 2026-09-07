import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sendStaticFile} from '../web/static-files.mjs';

test('static assets stream, support HEAD/304, and cache only fingerprinted art permanently',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'donut-assets-'));await mkdir(join(dir,'assets/shop'),{recursive:true});
 const art=join(dir,'assets/shop/chair-art-123456abcdef.png'),html=join(dir,'index.html');
 const bytes=Buffer.alloc(200000,173);await writeFile(art,bytes);await writeFile(html,'old page');
 const server=createServer((req,res)=>{
  if(req.headers.authorization!=='test'){res.writeHead(401,{'cache-control':'no-store'});res.end();return;}
  sendStaticFile(req,res,req.url==='/art'?art:html,req.url==='/art'?'image/png':'text/html').catch(()=>res.destroy());
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
 const first=await fetch(base+'/art',{headers:{authorization:'test'}});assert.equal(first.status,200);assert.deepEqual(Buffer.from(await first.arrayBuffer()),bytes);assert.match(first.headers.get('cache-control'),/private.*immutable/);
 const headers={authorization:'test','if-none-match':first.headers.get('etag')};const cached=await fetch(base+'/art',{headers});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 const head=await fetch(base+'/art',{method:'HEAD',headers:{authorization:'test'}});assert.equal(head.headers.get('content-length'),String(bytes.length));assert.equal((await head.arrayBuffer()).byteLength,0);
 const denied=await fetch(base+'/art',{headers:{'if-none-match':headers['if-none-match']}});assert.equal(denied.status,401,'cache validation cannot bypass authorization');
 const page=await fetch(base+'/',{headers:{authorization:'test'}});assert.equal(page.headers.get('cache-control'),'private, no-cache');const etag=page.headers.get('etag');await page.text();await writeFile(html,'updated page');
 const next=await fetch(base+'/',{headers:{authorization:'test','if-none-match':etag}});assert.equal(next.status,200);assert.equal(await next.text(),'updated page');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
