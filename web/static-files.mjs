import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';

export async function sendStaticFile(request,response,filePath,contentType) {
  const metadata=await stat(filePath);
  if(!metadata.isFile())throw Object.assign(new Error('not_file'),{code:'ENOENT'});
  const fingerprinted=/\/assets\/shop\/[\w-]+-[a-f0-9]{12}\.png$/.test(filePath);
  const etag=`W/"${metadata.size.toString(16)}-${metadata.mtimeMs.toString(16)}"`;
  const headers={
    'content-type':contentType,
    'cache-control':fingerprinted?'private, max-age=31536000, immutable':'private, no-cache',
    etag,
    'last-modified':metadata.mtime.toUTCString()
  };
  // Authentication remains in the caller, before this cache validation.
  if(request.headers['if-none-match']?.split(',').map(value=>value.trim()).some(value=>value===etag||value==='*')){
    response.writeHead(304,headers);response.end();return;
  }
  response.writeHead(200,{...headers,'content-length':metadata.size});
  if(request.method==='HEAD'){response.end();return;}
  // Backpressure bounds buffering even when multiple slow clients fetch art.
  await pipeline(createReadStream(filePath),response);
}
