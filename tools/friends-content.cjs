'use strict';
const yaml=require('js-yaml'),cheerio=require('cheerio'),http=require('node:http'),https=require('node:https');
const {HttpProxyAgent}=require('http-proxy-agent'),{HttpsProxyAgent}=require('https-proxy-agent');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function url(value){let parsed;try{parsed=new URL(value);}catch{throw Error('Use an absolute HTTP or HTTPS URL.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Use HTTP/HTTPS without embedded credentials.');return parsed.href;}
function validate(data){
 if(!data||data.version!==1||!Array.isArray(data.items)||data.items.length>200||Object.keys(data).some(k=>!['version','items'].includes(k)))throw Error('Friends data must have version: 1 and up to 200 items.');
 const ids=new Set(),urls=new Set();
 for(const item of data.items){
  if(!item||Object.keys(item).some(k=>!['id','name','url','avatar'].includes(k)))throw Error('Friend fields: id, name, url, avatar.');
  if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id||'')||ids.has(item.id))throw Error('Friend ID must be unique lowercase letters, numbers and hyphens.');ids.add(item.id);
  if(typeof item.name!=='string'||!item.name.trim()||item.name.length>200)throw Error('Friend name must be 1–200 characters.');
  const address=url(item.url);if(urls.has(address))throw Error('This homepage is already in friends.');urls.add(address);
  if(item.avatar!==null)url(item.avatar);
 }return data;
}
const parse=source=>validate(yaml.load(source));
const serialize=data=>'# 友链：使用 friends 命令管理；页面仅显示头像与站名链接。\n'+yaml.dump(validate(data),{lineWidth:120,noRefs:true});
function options(args){const fields={};while(args.length){const flag=args.shift();if(!['--name','--avatar','--id','--url'].includes(flag))throw Error('Use --name, --avatar, --id or --url.');const key=flag.slice(2),value=args.shift();if(!value||fields[key]!==undefined)throw Error('Provide each option once with a value.');fields[key]=value;}if(fields.avatar==='none')fields.avatar=null;return fields;}
function readHtml(address,redirects=0,deadline=Date.now()+15000){
 address=url(address);if(redirects>3||Date.now()>=deadline)return Promise.reject(Error('Homepage fetch timed out or redirected too often.'));
 return new Promise((resolve,reject)=>{
  const parsed=new URL(address),proxy=parsed.protocol==='https:'?(process.env.HTTPS_PROXY||process.env.HTTP_PROXY):process.env.HTTP_PROXY;
  const agent=proxy?(parsed.protocol==='https:'?new HttpsProxyAgent(proxy):new HttpProxyAgent(proxy)):undefined;
  const req=(parsed.protocol==='https:'?https:http).get(address,{agent,headers:{'User-Agent':'shamot-friends/1.0','Accept':'text/html'}},res=>{
   if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();return readHtml(new URL(res.headers.location,address).href,redirects+1,deadline).then(resolve,reject);}
   if(res.statusCode!==200){res.resume();return reject(Error('Homepage returned HTTP '+res.statusCode));}
   if(!/text\/html|application\/xhtml\+xml/i.test(res.headers['content-type']||'')){res.resume();return reject(Error('Homepage did not return HTML.'));}
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){req.destroy(Error('Homepage exceeds 1 MiB.'));return;}chunks.push(chunk);});
   res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),address}));res.on('error',reject);
  });
  const timer=setTimeout(()=>req.destroy(Error('Homepage request timed out.')),Math.max(1,deadline-Date.now()));req.on('error',reject);req.on('close',()=>clearTimeout(timer));
 });
}
function discover(html,address){
 const $=cheerio.load(html),baseTag=$('base[href]').first().attr('href');let base=address;try{if(baseTag)base=url(new URL(baseTag,address).href);}catch{}
 const name=($('meta[property="og:site_name"]').attr('content')||$('title').first().text()||$('h1').first().text()||new URL(address).hostname).replace(/\s+/g,' ').trim().slice(0,200);
 const avatars=$('img.avatar-photo,img.avatar,img[class*="avatar"],img[id*="avatar"],.avatar img,.author img').toArray().concat($('link[rel="apple-touch-icon"],link[rel="icon"],link[rel="shortcut icon"]').toArray());
 let avatar=null;for(const node of avatars){const raw=$(node).attr('src')||$(node).attr('data-src')||$(node).attr('href');try{if(raw){avatar=url(new URL(raw,base).href);break;}}catch{}}
 return {name,avatar};
}
async function apply(data,operation,args,load=readHtml){
 data=structuredClone(validate(data));args=[...args];
 if(operation==='add'){
  const address=url(args.shift()),fields=options(args);if(fields.url)throw Error('Use friends add URL, not --url.');
  if(data.items.some(item=>url(item.url)===address))throw Error('This homepage is already in friends.');
  let detected={name:new URL(address).hostname,avatar:null},warning;
  if(fields.name===undefined||fields.avatar===undefined){try{const page=await load(address);detected=discover(page.html,page.address);}catch(error){if(fields.name===undefined)throw Error('Could not read homepage: '+error.message+'. Retry or supply --name "Site name" [--avatar URL|none].');warning='Could not detect avatar; using a letter mark. Set it later with friends set ID --avatar URL.';}}
  let id=fields.id||new URL(address).hostname.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);if(!fields.id){const base=id;let n=2;while(data.items.some(i=>i.id===id))id=base+'-'+n++;}
  const item={id,name:fields.name??detected.name,url:address,avatar:fields.avatar===undefined?detected.avatar:fields.avatar};data.items.push(item);return {data:validate(data),item,warning};
 }
 const id=args.shift(),index=data.items.findIndex(item=>item.id===id);if(index<0)throw Error('Friend not found. Use friends list.');
 if(operation==='remove'){if(args.length!==1||args[0]!=='--confirm')throw Error('Use friends remove ID --confirm.');const [item]=data.items.splice(index,1);return {data:validate(data),item};}
 if(!['set','update'].includes(operation))throw Error('Use friends add/set/remove.');
 const fields=options(args);if(!Object.keys(fields).length||fields.id!==undefined)throw Error('Supply --name, --url or --avatar; ID stays unchanged.');data.items[index]={...data.items[index],...fields};return {data:validate(data),item:data.items[index]};
}
function render(data){
 validate(data);if(!data.items.length)return '<p>这里暂时还没有友链。</p>';
 return '<div class="shamot-friend-list">'+data.items.map(item=>{
 const letter=escape(Array.from(item.name)[0].toUpperCase());
 const mark=item.avatar?'<img class="shamot-friend-avatar" src="'+escape(item.avatar)+'" alt="" width="48" height="48" loading="lazy" decoding="async">':'<svg class="shamot-friend-avatar shamot-friend-monogram" viewBox="0 0 48 48" aria-hidden="true"><text x="24" y="25" text-anchor="middle" dominant-baseline="middle">'+letter+'</text></svg>';
 return '<a class="shamot-friend-link" data-friend-id="'+escape(item.id)+'" href="'+escape(item.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+escape('访问 '+item.name+'（在新标签页打开）')+'">'+mark+'<span class="shamot-friend-name">'+escape(item.name)+'</span><span class="shamot-friend-arrow" aria-hidden="true">↗</span></a>';
 }).join('')+'</div>';
}
module.exports={validate,parse,serialize,options,discover,apply,render,readHtml};
