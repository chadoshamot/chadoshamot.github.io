'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const friends=require('./friends-content.cjs'),{createBridge}=require('./bridge.cjs');
const empty=()=>({version:1,items:[]});
test('friend discovery: relative avatar, title entities, icon and absent avatar',()=>{
 assert.deepEqual(friends.discover('<title>A &amp; B</title><img class="avatar" src="../me.jpg">','https://example.com/blog/'),{name:'A & B',avatar:'https://example.com/me.jpg'});
 assert.deepEqual(friends.discover('<meta property="og:site_name" content="Actual"><title>Other</title><base href="https://cdn.example.com/a/"><link rel="icon" href="i.png">','https://example.com/'),{name:'Actual',avatar:'https://cdn.example.com/a/i.png'});
 assert.equal(friends.discover('<link rel="icon" href="/icon.png"><img class="avatar" src="/person.jpg">','https://example.com/').avatar,'https://example.com/person.jpg');
 assert.equal(friends.discover('<title>No photo</title><img class="avatar" src="javascript:alert(1)">','https://example.com/').avatar,null);
});
test('friend CRUD through bridge: duplicate rejection, backups, rerender, escaping and editor validation',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shamot-friends-')),file=path.join(root,'source/_data/friends.yml'),page=path.join(root,'source/friends/index.md');await fs.mkdir(path.dirname(file),{recursive:true});await fs.mkdir(path.dirname(page),{recursive:true});await fs.writeFile(file,friends.serialize(empty()));await fs.writeFile(page,'{% shamot_friends %}');await fs.utimes(page,new Date(0),new Date(0));
 const bridge=createBridge({root,friendLoader:async address=>({address,html:'<title>Test &amp; friends</title><img id="avatar" src="/avatar.jpg">'})});await new Promise(r=>bridge.server.listen(0,'127.0.0.1',r));
 const run=async line=>{const events=[];await bridge.command(line,e=>events.push(e));return events;},load=async()=>friends.parse(await fs.readFile(file,'utf8'));
 try{
  await run('friends add https://example.com/');let data=await load();assert.equal(data.items[0].avatar,'https://example.com/avatar.jpg');assert.equal(data.items[0].name,'Test & friends');assert((await fs.stat(page)).mtimeMs>1000);
  await run('friends set example-com --name "<script> unsafe"');data=await load();assert.equal(data.items[0].avatar,'https://example.com/avatar.jpg');assert(friends.render(data).includes('&lt;script&gt;'));assert(!friends.render(data).includes('<script>'));
  for(const command of ['friends add https://example.com/','friends add https://other.com/ --id example-com','friends set example-com --url javascript:bad','friends set example-com --avatar data:text/html,bad','friends remove example-com','friends add https://user:secret@example.net/','friends set example-com --id new','friends set example-com --unknown x']){const before=await fs.readFile(file,'utf8');await assert.rejects(run(command));assert.equal(await fs.readFile(file,'utf8'),before);}
  await run('friends update example-com --avatar none');assert(friends.render(await load()).includes('<svg'));assert(!friends.render(await load()).includes('<img'));
  await run('friends add https://no-fetch.com/ --name "Offline" --avatar none --id offline');assert.equal((await load()).items.length,2);assert((await run('friends list')).some(e=>e.text.includes('offline')));
  const editor=(await run('friends edit')).find(e=>e.type==='editor');const base='http://127.0.0.1:'+bridge.server.address().port,pairPage=await(await fetch(base+'/pair')).text(),code=pairPage.match(/connect http:\/\/[^ ]+ ([a-f0-9]{36})/)[1],paired=await(await fetch(base+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})})).json();
  const save=text=>fetch(base+'/api/save',{method:'POST',headers:{Authorization:'Bearer '+paired.token,'Content-Type':'application/json'},body:JSON.stringify({...editor,text})});assert.equal((await save('version: 1\nitems: broken')).status,400);assert.equal((await load()).items.length,2);
  data=await load();data.items[0].name='Editor saved';assert.equal((await save(friends.serialize(data))).status,200);assert.equal((await save(editor.text)).status,400);
  await run('friends remove offline --confirm');assert.equal((await load()).items.length,1);const backups=await fs.readdir(path.join(root,'.shamot/backups'));assert.equal(backups.length,6);
 }finally{await bridge.close();await fs.rm(root,{recursive:true,force:true});}
});
test('network failure needs name override; explicit metadata bypasses fetch',async()=>{
 const fail=async()=>{throw Error('offline')};await assert.rejects(friends.apply(empty(),'add',['https://example.com/'],fail),/--name/);
 const result=await friends.apply(empty(),'add',['https://example.com/','--name','Example'],fail);assert.equal(result.item.avatar,null);assert(result.warning);
 const bypass=await friends.apply(empty(),'add',['https://example.com/','--name','Example','--avatar','none'],()=>{throw Error('must not fetch')});assert.equal(bypass.item.name,'Example');
});
test('bounded HTML reader follows redirects and rejects non-HTML and oversized responses',async()=>{
 const server=http.createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'/ok'});return res.end();}res.setHeader('Content-Type',req.url==='/binary'?'image/png':'text/html');res.end(req.url==='/large'?'x'.repeat(1024*1024+1):'<title>Local fixture</title>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const proxy=process.env.HTTP_PROXY;delete process.env.HTTP_PROXY;
 try{const page=await friends.readHtml(base+'/redirect');assert.equal(page.address,base+'/ok');assert(page.html.includes('Local fixture'));await assert.rejects(friends.readHtml(base+'/binary'),/HTML/);await assert.rejects(friends.readHtml(base+'/large'),/1 MiB/);}finally{if(proxy!==undefined)process.env.HTTP_PROXY=proxy;await new Promise(r=>server.close(r));}
});
