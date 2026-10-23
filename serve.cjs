'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/elements.js':'elements.js','/style.css':'style.css'};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const file=files[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname,file),(error,data)=>{
    if(error){res.writeHead(500);res.end('Unable to read site file');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(data);
  });
});
server.listen(4173,'127.0.0.1',()=>console.log('Orbital Studio: http://127.0.0.1:4173'));
