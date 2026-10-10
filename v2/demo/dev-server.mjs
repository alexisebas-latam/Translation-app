// Local-only read-only HTTP server for Plazo 2.0 responsive laboratory.
// Never use as a production server; no external network or credentials.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const port=4173;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.png':'image/png','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const headers={
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  };
  const finish=(status,msg)=>{res.writeHead(status,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end(msg);};
  if(req.method!=='GET'&&req.method!=='HEAD')return finish(405,'Método no admitido');
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const decoded=decodeURIComponent(url.pathname);
    const route=decoded.endsWith('/')?decoded+'index.html':decoded;
    const file=resolve(root,'.'+route);
    if(!file.startsWith(root+sep)||!types[extname(file)]||route.startsWith('/.'))return finish(403,'Archivo no permitido');
    const s=await stat(file);
    if(!s.isFile())return finish(404,'Archivo no encontrado');
    const body=await readFile(file);
    res.writeHead(200,{...headers,'Content-Type':types[extname(file)]});
    if(req.method==='HEAD')res.end();
    else res.end(body);
  }catch{return finish(404,'Archivo no encontrado');}
});
server.listen(port,'127.0.0.1',()=>console.log('Plazo laboratorio local: http://127.0.0.1:'+port+'/v2/demo/'));
