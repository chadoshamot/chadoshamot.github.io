'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createBridge}=require('./bridge.cjs');
const about=require('./about-content.cjs');
test('about profile CRUD: preserved fields, validation, backups, rendering and editor conflicts',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'shamot-about-test-'));
 const dataFile=path.join(root,'source/_data/about.yml');await fs.mkdir(path.dirname(dataFile),{recursive:true});
 const initial={version:1,topics:[],music:[{id:'synthwave',title:'Synthwave',paragraphs:['Original paragraph','Second paragraph'],links:[{title:'Track',url:'https://example.com/track'}]}],sports:[],other:[]};
 await fs.writeFile(dataFile,about.serialize(initial));
 const bridge=createBridge({root});await new Promise(resolve=>bridge.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+bridge.server.address().port;
 const command=async line=>{const events=[];await bridge.command(line,event=>events.push(event));return events;};
 const load=async()=>about.parse(await fs.readFile(dataFile,'utf8'));
 try{
  const listed=await command('about list music');assert(listed.some(e=>e.text.includes('synthwave')));
  await command('about add topics reasoning --title "LLM <script>" --text "第一段" --text "Quoted \'word\'" --link "Video" "https://example.com/?a=1&b=2"');
  let data=await load();assert.equal(data.topics[0].paragraphs.length,2);assert.equal(data.music[0].links[0].url,'https://example.com/track');
  assert(about.render(data).includes('&lt;script&gt;'));assert(!about.render(data).includes('<script>'));assert(about.render(data).includes('&amp;b=2'));
  await command('about set music synthwave --title "New name"');data=await load();assert.equal(data.music[0].paragraphs.length,2);assert.equal(data.music[0].links.length,1);
  await command('about update music synthwave --text "New body" --link "One" "https://example.com/1" --link "Two" "https://example.com/2"');
  data=await load();assert.deepEqual(data.music[0].paragraphs,['New body']);assert.equal(data.music[0].links.length,2);
  await command('about set music synthwave --clear-links');assert.equal((await load()).music[0].links.length,0);
  for(const line of ['about add topics reasoning --title "Duplicate" --text "Body"','about add music missing --title "Missing body"','about set music synthwave --link "Unsafe" "javascript:alert(1)"','about remove topics reasoning','about set unknown synthwave --title "No"','about set music synthwave --unknown value','about add other invalid/id --title "No" --text "No"']){
   const before=await fs.readFile(dataFile,'utf8');await assert.rejects(command(line));assert.equal(await fs.readFile(dataFile,'utf8'),before);
  }
  const page=await(await fetch(url+'/pair')).text(),code=page.match(/connect http:\/\/[^ ]+ ([a-f0-9]{36})/)[1];
  const paired=await(await fetch(url+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})})).json();
  const save=body=>fetch(url+'/api/save',{method:'POST',headers:{Authorization:'Bearer '+paired.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const editor=(await command('about edit')).find(e=>e.type==='editor');assert.equal(editor.path,dataFile);
  const invalid=await save({...editor,text:'version: 1\nmusic: broken\n'});assert.equal(invalid.status,400);assert.equal((await load()).music[0].title,'New name');
  const editData=about.parse(editor.text);editData.music[0].title='Saved through editor';const saved=await save({...editor,text:about.serialize(editData)});assert.equal(saved.status,200);assert.equal((await load()).music[0].title,'Saved through editor');
  const stale=await save({...editor,text:editor.text});assert.equal(stale.status,400);assert((await stale.json()).error.includes('changed since opening'));
  await command('about remove topics reasoning --confirm');assert.equal((await load()).topics.length,0);assert(about.render(await load()).includes('这里暂时还没有内容'));
  const backups=await fs.readdir(path.join(root,'.shamot/backups'));assert.equal(backups.length,6);
  for(const dir of backups){const snapshot=about.parse(await fs.readFile(path.join(root,'.shamot/backups',dir,'about.yml'),'utf8'));assert.equal(snapshot.version,1);}
 }finally{await bridge.close();await fs.rm(root,{recursive:true,force:true});}
});
