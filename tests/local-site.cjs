'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),siteUrl='http://local-app.test/index.html';
async function serveLocalSite(page){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://local-app.test')return route.abort();
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
  const contentType=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'application/javascript':file.endsWith('.woff2')?'font/woff2':'application/octet-stream';
  await route.fulfill({contentType,body:fs.readFileSync(file)});
 });
}
module.exports={serveLocalSite,siteUrl};
