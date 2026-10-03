'use strict';
// Owner-only loopback companion for the static GitHub Pages terminal.
const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const {spawn} = require('node:child_process');
const yaml = require('js-yaml');
const about = require('./about-content.cjs');
const friends = require('./friends-content.cjs');
const ROOT = path.resolve(__dirname, '..');
const HARN_VERSION = '0.2.0-rc.2';
const BAD = /(^|[\\/])(\.git|\.shamot|node_modules|\.env(?:\..*)?|\.credentials.*)([\\/]|$)/i;
const EDIT_LIMIT = 4 * 1024 * 1024;
const MEDIA_LIMIT = 64 * 1024 * 1024;
const HELP = fs.readFileSync(path.join(ROOT, 'source/assets/terminal-help.txt'), 'utf8');
function words(line) {
  const out = []; let word = '', quote = '', started = false;
  for (const ch of line.trim()) {
    if (quote) { if (ch === quote) quote = ''; else word += ch; }
    else if (ch === '"' || ch === "'") { quote = ch; started = true; }
    else if (/\s/.test(ch)) { if (started) {out.push(word); word = ''; started = false;} }
    else {word += ch; started = true;}
  }
  if (quote) throw Error('Unclosed quote. Quote paths containing spaces.');
  if (started) out.push(word);
  return out;
}
const within = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
function validPort(value) { const port = Number(value); if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Port must be between 1024 and 65535.'); return port; }
function slug(value) {if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(value || '')) throw Error('Use a lowercase slug containing letters, numbers and hyphens.'); return value;}
async function portAvailable(port) {await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error(`Port ${port} is already in use. Choose another port.`)));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});}
function createBridge(options = {}) {
  const root = fs.realpathSync(options.root || ROOT);
  const stateDir = path.join(root, '.shamot'); fs.mkdirSync(stateDir, {recursive:true});
  const stateFile = path.join(stateDir, 'bridge.json');
  const aboutFile = path.join(root, 'source/_data/about.yml');
  const friendsFile = path.join(root, 'source/_data/friends.yml');
  let settings = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const port = validPort(options.port || settings.port || 4317);
  const state = {cwd:root, roots:new Map([['site', root]]), preview:null, harness:null, job:null, busy:false, session:settings.sessionId || null};
  let pairCode = crypto.randomBytes(18).toString('hex');
  const tokens = new Map();
  const home = path.join(stateDir, 'dsh-home');
  const install = path.join(stateDir, 'harness');
  const binary = path.join(install, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
  const env = () => ({...process.env, PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH,
    DSH_HOME:home, DSH_TELEMETRY_MODE:'DISABLED', GIT_TERMINAL_PROMPT:'0', GCM_INTERACTIVE:'never',
    GIT_CONFIG_COUNT:'1', GIT_CONFIG_KEY_0:'safe.directory', GIT_CONFIG_VALUE_0:root.replaceAll('\\','/')});
  const harnessEnv = () => ({...env(),DSH_PERMISSION_MODE:(settings.harnessAccess||'full')==='full'?'danger-full-access':'workspace-write'});
  async function resolveFile(value = '.', write = false) {
    let file;
    if (value.startsWith('@')) {
      const match = value.match(/^@([^/\\]+)(?:[/\\](.*))?$/); const base = state.roots.get(match?.[1]);
      if (!base) throw Error('Unknown mount. Use mount NAME "absolute path".');
      file = path.resolve(base, match[2] || '.');
    } else file = path.resolve(state.cwd, value);
    const allowed = [...state.roots.values()].find(base => within(base, file));
    if (!allowed) throw Error('Path is outside mounted roots. Mount the folder explicitly first.');
    if (BAD.test(path.relative(allowed, file))) throw Error('Private/runtime files are excluded from file commands.');
    let cursor = file;
    while (!fs.existsSync(cursor)) {const next = path.dirname(cursor); if (next === cursor) throw Error('Path not found.'); cursor = next;}
    const real = await fsp.realpath(cursor);
    if (!within(allowed, real)) throw Error('Symlink escapes the mounted root.');
    if (!write && !fs.existsSync(file)) throw Error('File does not exist.');
    return file;
  }
  async function put(file, data, overwrite = false) {
    if (!overwrite && fs.existsSync(file)) throw Error('Destination exists. Use edit, or supply --overwrite explicitly.');
    await fsp.mkdir(path.dirname(file), {recursive:true});
    if (fs.existsSync(file)) {
      const backup = path.join(stateDir,'backups',crypto.randomUUID(),path.basename(file));
      await fsp.mkdir(path.dirname(backup), {recursive:true}); await fsp.copyFile(file,backup);
    }
    const tmp = file+'.shamot-'+crypto.randomUUID()+'.tmp';
    await fsp.writeFile(tmp, data); await fsp.rename(tmp, file);
    // Hexo caches tag output; touch the host page so an active preview renders new data.
    if(file===friendsFile&&fs.existsSync(path.join(root,'source/friends/index.md'))){const page=await resolveFile('@site/source/friends/index.md');const now=new Date();await fsp.utimes(page,now,now);}
    if(file===aboutFile&&fs.existsSync(path.join(root,'source/about/index.md'))){const page=await resolveFile('@site/source/about/index.md');const now=new Date();await fsp.utimes(page,now,now);}
  }
  function run(exe, args, emit, opt = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(exe,args,{cwd:opt.cwd || root,env:{...env(),...opt.env},windowsHide:true,stdio:['pipe','pipe','pipe']});
      state.job = child;
      let captured = '', remainder = ''; let failedLog = false;
      const timeout = setTimeout(() => {kill(child); reject(Error('Command exceeded its time limit.'));},opt.timeout || 20*60*1000);
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', text => {
        if (captured.length < 16*1024*1024) captured += text;
        if (opt.json) {remainder += text; const lines = remainder.split('\n'); remainder = lines.pop();
          for (const line of lines) {try {const event=JSON.parse(line); if(event.type==='session') state.session=event.sessionId || event.id;
            emit({type:'harness',event});} catch {emit({type:'output',text:line+'\n'});}}}
        else emit({type:'output',text});
        if (/ERROR\s|FATAL\s/.test(text)) failedLog=true;
      });
      child.stderr.on('data', text => {emit({type:'output',text}); if (/ERROR\s|FATAL\s/.test(text)) failedLog=true;});
      child.on('error', error => {clearTimeout(timeout); if(state.job===child)state.job=null; reject(error);});
      child.on('close', code => {clearTimeout(timeout); if(state.job===child)state.job=null;
        if (code !== 0 || (opt.hexo && failedLog)) reject(Error(`Command failed (exit ${code}). Review the output above.`)); else resolve(captured);});
      child.stdin.end(opt.input || '');
    });
  }
  function kill(child) {
    if (!child) return;
    if(process.platform==='win32') spawn('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});
    else child.kill('SIGTERM');
  }
  const hexo = args => [path.join(root,'node_modules/hexo/bin/hexo'),...args];
  const git = (args,emit) => run('git',args,emit);
  async function harnessPatch() {
    await fsp.mkdir(home,{recursive:true});
    const patch = [{id:'session-log-deepseek',config:{enabled:false}},
      {id:'agent-default-model',config:{provider:settings.provider || 'deepseek-official', model:settings.model || 'deepseek-flash'}}];
    await fsp.writeFile(path.join(home,'cordis.patch.yml'),yaml.dump(patch));
  }
  async function command(line, emit, payload = {}) {
    const a = words(line); const cmd = a.shift(); const sub = a.shift();
    const output = text => emit({type:'output',text:String(text)+'\n'});
    const requireArg = value => {if(value === undefined || value==='') throw Error('Missing argument. Type help.'); return value;};
    switch(cmd) {
      case 'help': output(sub ? HELP.split('\n').filter((text,i,all) => text.toLowerCase().includes(sub.toLowerCase()) || (i>0&&all[i-1].toLowerCase().includes(sub.toLowerCase()))).join('\n') || 'No match. Type help for all commands.' : HELP); break;
      case 'pwd': output(state.cwd); break;
      case 'mount': {
        if(!sub) {output([...state.roots].map(([name,dir])=>`@${name}  ${dir}`).join('\n'));break;}
        if(!/^[a-z][a-z0-9-]*$/.test(sub)||sub==='site') throw Error('Choose a mount name such as graduate.');
        const dir=await fsp.realpath(requireArg(a[0])); if(BAD.test(dir))throw Error('Private/runtime folders cannot be mounted.');if(!(await fsp.stat(dir)).isDirectory()) throw Error('Mount a directory.');
        state.roots.set(sub,dir);output(`Mounted @${sub}: ${dir} (this bridge session only).`);break;
      }
      case 'cd': {const dir=await resolveFile(requireArg(sub)); if(!(await fsp.stat(dir)).isDirectory())throw Error('Not a directory.');state.cwd=dir;output(dir);break;}
      case 'ls': {const dir=await resolveFile(sub||'.');const entries=await fsp.readdir(dir,{withFileTypes:true});output(entries.filter(e=>!BAD.test(e.name)).map(e=>(e.isDirectory()?'dir  ':'file ')+e.name).join('\n'));break;}
      case 'cat': case 'read': case 'edit': {const file=await resolveFile(requireArg(sub));if((await fsp.stat(file)).size>EDIT_LIMIT)throw Error('Text editor limit: 4 MiB.');const bytes=await fsp.readFile(file);if(bytes.includes(0))throw Error('This is a binary file. Use download.');const text=bytes.toString('utf8'); if(cmd==='edit')emit({type:'editor',path:file,text,hash:crypto.createHash('sha256').update(bytes).digest('hex')});else output(text);break;}
      case 'resources': {
        const entries=[['Articles','source/_posts'],['About page','source/about/index.md'],['About profile entries (about commands)','source/_data/about.yml'],['Friends page','source/friends/index.md'],['Friend links (friends commands)','source/_data/friends.yml'],['Projects','source/_data/projects.yml'],['Categories and colors','source/_data/taxonomy.yml'],['Sidebar widgets','source/_data/widgets.yml'],['Media, CSS, JS','source/assets'],['Uploaded media','source/assets/uploads'],['Hexo config','_config.yml'],['Stellar config and signature','_config.stellar.yml'],['Generators','scripts'],['Generated output (rebuildable)','public'],['Official theme dependency','node_modules/hexo-theme-stellar'],['Deployment workflow','.github/workflows/pages.yml'],['Private local runtime/credentials/backups','.shamot']];
        output('LOCAL SOURCE ROOT: '+root);for(const [name,file]of entries)output(name+': '+path.join(root,file));output('GitHub source: https://github.com/chadoshamot/chadoshamot.github.io\nPublished static site: https://chadoshamot.github.io/\nEdit/import changes local source. publish builds and deploys it.');break;
      }
      case 'download': emit({type:'download',path:await resolveFile(requireArg(sub))});break;
      case 'remove': {if(a[0]!=='--confirm')throw Error('Use remove PATH --confirm. Removed files move to local trash.');const file=await resolveFile(requireArg(sub));if(file===root||[...state.roots.values()].includes(file))throw Error('Cannot remove a mount root.');const dest=path.join(stateDir,'trash',crypto.randomUUID(),path.basename(file));await fsp.mkdir(path.dirname(dest),{recursive:true});await fsp.rename(file,dest);output(`Moved to trash: ${dest}`);break;}
      case 'new': {const name=slug(sub); const titleIndex=a.indexOf('--title');const categoryIndex=a.indexOf('--category'); const meta={title:titleIndex>=0?requireArg(a[titleIndex+1]):name,date:new Date(),categories:[categoryIndex>=0?requireArg(a[categoryIndex+1]):'学习'],tags:[]};const file=await resolveFile('@site/source/_posts/'+name+'.md',true); await put(file,'---\n'+yaml.dump(meta)+'---\n\n');output(`Created ${file}. Use edit to write the article.`);break;}
      case 'import': {
        const from=await resolveFile(requireArg(sub));const name=slug(a[0]);const file=await resolveFile('@site/source/_posts/'+name+'.md',true);
        if(path.extname(from).toLowerCase()!=='.md')throw Error('Use asset for media; import accepts Markdown.');
        if((await fsp.stat(from)).size>EDIT_LIMIT)throw Error('Markdown limit: 4 MiB.');let text=await fsp.readFile(from,'utf8');
        const hasFront=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(text);
        const ix=a.indexOf('--category');const ti=a.indexOf('--title'); const category=ix>=0?requireArg(a[ix+1]):'学习';
        if(!hasFront)text='---\n'+yaml.dump({title:ti>=0?requireArg(a[ti+1]):(text.match(/^#\s+(.+)$/m)?.[1]||name),date:new Date(),categories:[category],tags:[]})+'---\n\n'+text;
        await put(file,text,a.includes('--overwrite'));output(`Imported ${file}\nRelative media links are unchanged. Import referenced media with asset or upload.`);break;
      }
      case 'asset': {const from=await resolveFile(requireArg(sub)); const dest=await resolveFile('@site/source/assets/uploads/'+requireArg(a[0]),true);if(!within(path.join(root,'source/assets/uploads'),dest))throw Error('Asset destination must stay under source/assets/uploads.');if((await fsp.stat(from)).size>MEDIA_LIMIT)throw Error('Media limit: 64 MiB.');await put(dest,await fsp.readFile(from),a.includes('--overwrite'));output('URL: /assets/uploads/'+path.relative(path.join(root,'source/assets/uploads'),dest).replaceAll('\\','/'));break;}
      case 'posts': output((await fsp.readdir(path.join(root,'source/_posts'))).filter(s=>s.endsWith('.md')).join('\n'));break;
      case 'about': {
        if(sub==='help'){output(HELP.split('\n').filter(text=>text.includes('about')).join('\n'));break;}
        const file=await resolveFile('@site/source/_data/about.yml');
        const data=about.parse(await fsp.readFile(file,'utf8'));
        if(sub==='edit'){if(a.length)throw Error('Use about edit to open all profile entries.');const bytes=await fsp.readFile(file);emit({type:'editor',path:file,text:bytes.toString('utf8'),hash:crypto.createHash('sha256').update(bytes).digest('hex')});break;}
        if(!sub||sub==='list'||sub==='tabs'){
          if(a.length>1||sub==='tabs'&&a.length)throw Error('Use about list [TAB] or about tabs.');
          const selected=a[0];if(selected&&!about.tabs.some(([key])=>key===selected))throw Error('Tab must be topics, music, sports or other.');
          for(const [key,label]of about.tabs){if(selected&&selected!==key)continue;output(key+' / '+label+' ('+data[key].length+')');if(sub!=='tabs')for(const item of data[key])output('  '+item.id+'  '+item.title);}
          output('Use about show TAB ID, about add/set/remove, or about edit. help zh about / help en about');break;
        }
        if(sub==='show'){
          if(a.length!==2||!about.tabs.some(([key])=>key===a[0]))throw Error('Use about show TAB ID.');const item=data[a[0]].find(item=>item.id===a[1]);if(!item)throw Error('Entry not found. Use about list.');output(yaml.dump(item,{lineWidth:100}));break;
        }
        if(!['add','set','update','remove'].includes(sub))throw Error('Use about list/show/add/set/remove/edit. help zh about');
        const key=a[0],id=a[1];await put(file,about.serialize(about.apply(data,sub,a)),true);
        output('Saved '+key+'/'+id+' ('+sub+'). Changes are local; refresh the running preview, or use preview start / build to inspect, then publish "Update about profile" to deploy.');break;
      }
      case 'friends': {
        if(sub==='help'){output(HELP.split('\n').filter(text=>text.includes('friends')).join('\n'));break;}
        const file=await resolveFile('@site/source/_data/friends.yml',true);
        const data=fs.existsSync(file)?friends.parse(await fsp.readFile(file,'utf8')):{version:1,items:[]};
        if(!sub||sub==='list'){if(a.length)throw Error('Use friends list.');for(const item of data.items)output(item.id+'  '+item.name+'  '+item.url);if(!data.items.length)output('No friends yet. Use friends add URL.');break;}
        if(sub==='show'){if(a.length!==1)throw Error('Use friends show ID.');const item=data.items.find(item=>item.id===a[0]);if(!item)throw Error('Friend not found. Use friends list.');output(yaml.dump(item));break;}
        if(sub==='edit'){if(a.length)throw Error('Use friends edit.');if(!fs.existsSync(file))await put(file,friends.serialize(data));const bytes=await fsp.readFile(file);emit({type:'editor',path:file,text:bytes.toString('utf8'),hash:crypto.createHash('sha256').update(bytes).digest('hex')});break;}
        if(!['add','set','update','remove'].includes(sub))throw Error('Use friends list/show/add/set/remove/edit. help zh friends');
        const result=await friends.apply(data,sub,a,options.friendLoader);
        await put(file,friends.serialize(result.data),true);if(result.warning)output(result.warning);
        output('Saved '+result.item.id+' ('+sub+'). Avatar: '+(result.item.avatar||'letter mark')+'. Changes are local; use preview start / build, then publish "Update friend links" to deploy.');break;
      }
      case 'projects': output(await fsp.readFile(path.join(root,'source/_data/projects.yml'),'utf8'));break;
      case 'search': {const query=requireArg(sub).toLowerCase();let count=0;async function walk(dir){for(const ent of await fsp.readdir(dir,{withFileTypes:true})){const file=path.join(dir,ent.name);if(ent.isDirectory())await walk(file);else if(/\.(md|yml|css|js|txt)$/.test(ent.name)&&(await fsp.stat(file)).size<EDIT_LIMIT){const lines=(await fsp.readFile(file,'utf8')).split('\n');lines.forEach((text,i)=>{if(text.toLowerCase().includes(query)&&count++<100)output(`${path.relative(root,file)}:${i+1}: ${text}`);});}}}await walk(path.join(root,'source'));output(`${count} matches (first 100 shown).`);break;}
      case 'config': {
        const operation=sub, scope=requireArg(a.shift()),key=requireArg(a.shift());
        const file=scope==='site'?'_config.yml':scope==='theme'?'_config.stellar.yml':null;
        if(!file)throw Error('Scope must be site or theme.');const parts=key.split('.');if(parts.some(p=>!p||['__proto__','constructor','prototype'].includes(p))||/key|token|secret|password/i.test(key))throw Error('Invalid configuration key. Use harness configure for credentials.');
        const full=path.join(root,file);const doc=yaml.load(await fsp.readFile(full,'utf8'));let target=doc;
        for(const part of parts.slice(0,-1)){if(!target[part])target[part]={};if(typeof target[part]!=='object'||target[part]===null)throw Error('Parent is not an object.');target=target[part];}
        if(operation==='get')output(JSON.stringify(target[parts.at(-1)],null,2));
        else if(operation==='set'){const raw=requireArg(a.join(' '));let value;try{value=JSON.parse(raw);}catch{value=raw;}target[parts.at(-1)]=value;await put(full,yaml.dump(doc,{lineWidth:-1,noRefs:true}),true);output(`Updated ${file}: ${key}. Run build or preview to inspect.`);}else throw Error('Use config get or config set.');break;
      }
      case 'status': output(`Root: ${root}\nWorking directory: ${state.cwd}\nBridge: http://127.0.0.1:${server.address()?.port || port}\nPreview: ${state.preview?.url || 'stopped'}\nHarness: ${fs.existsSync(binary)?HARN_VERSION:'not installed'}\nHarness web: ${state.harness?.url || 'stopped'}\nSession: ${state.session||'new'}\nPrivate state: ${stateDir}`);await git(['status','--short'],emit);break;
      case 'changes': await git(['diff','--stat'],emit);await git(['diff'],emit);break;
      case 'git': {if(!['status','diff','log','pull','push'].includes(sub))throw Error('Supported: git status/diff/log/pull/push. Use shell for other owner commands.');if(a.some(x=>/force|exec|upload-pack|receive-pack|config|output|ext::/.test(x)))throw Error('Use shell explicitly for advanced Git options.');await git([sub,...a],emit);break;}
      case 'build': await run(process.execPath,hexo(['stellar','doctor']),emit,{hexo:true});await run(process.execPath,hexo(['clean']),emit,{hexo:true});await run(process.execPath,hexo(['generate']),emit,{hexo:true});break;
      case 'publish': {
        const message=requireArg([sub,...a].filter(v=>v!==undefined).join(' '));
        await run(process.execPath,hexo(['stellar','doctor']),emit,{hexo:true});await run(process.execPath,hexo(['clean']),emit,{hexo:true});await run(process.execPath,hexo(['generate']),emit,{hexo:true});
        await git(['add','--all','--','.'],emit); const staged=await git(['diff','--cached','--name-only'],emit);
        const privateFiles=staged.split('\n').filter(name=>BAD.test(name));
        if(privateFiles.length){await git(['restore','--staged','--',...privateFiles],emit);throw Error('Private/runtime files were staged. They have been unstaged; restore .gitignore before publishing.');}
        if(staged.trim())await git(['commit','-m',message],emit);await git(['push','origin','HEAD'],emit);output('Pushed. GitHub Actions will build and deploy Pages.');emit({type:'link',url:'https://github.com/chadoshamot/chadoshamot.github.io/actions'});break;
      }
      case 'shell': {const text=requireArg([sub,...a].join(' '));output('Running owner PowerShell command.');await run(process.platform==='win32'?'powershell.exe':'/bin/sh',process.platform==='win32'?['-NoProfile','-NonInteractive','-Command',text]:['-c',text],emit,{cwd:state.cwd});break;}
      case 'preview': {
        if(sub==='stop'){kill(state.preview?.child);state.preview=null;output('Preview stopped.');break;}
        if(sub==='status'){output(state.preview?.url||'Preview stopped.');break;}
        if(sub!=='start')throw Error('Use preview start [port], preview stop or preview status.');
        if(state.preview)throw Error('Preview is already running; stop it before changing its port.');
        const p=validPort(a[0]||4000);await portAvailable(p); const child=spawn(process.execPath,hexo(['server','--ip','127.0.0.1','--port',String(p)]),{cwd:root,env:env(),windowsHide:true,stdio:['ignore','pipe','pipe']});
        const url=`http://127.0.0.1:${p}/`;state.preview={child,url};await waitServer(child,p,emit);output(url);emit({type:'link',url});child.on('exit',()=>{if(state.preview?.child===child)state.preview=null;});break;
      }
      case 'bridge': {if(sub!=='port')throw Error('Use bridge port NUMBER, then restart the local launcher.');settings.port=validPort(a[0]);await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));output(`Saved port ${settings.port}. Restart the launcher, then connect to the new port.`);break;}
      case 'harness': {
        if(sub==='access'){if(!['full','workspace'].includes(a[0]))throw Error('Use harness access full or harness access workspace.');settings.harnessAccess=a[0];settings.sessionId=null;state.session=null;await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));output(`Harness access: ${a[0]}. Next CLI task starts a new session; earlier sessions remain on disk. Restart Harness web and create a new session for its permissions to change.`);break;}
        if(sub==='install') {
          const version=process.versions.node.split('.').map(Number);if(version[0]<22||(version[0]===22&&version[1]<19))throw Error('Harness needs Node >=22.19. Restart this bridge with a newer Node runtime.');
          await fsp.mkdir(install,{recursive:true});await fsp.writeFile(path.join(install,'package.json'),JSON.stringify({name:'shamot-private-harness',private:true,dependencies:{'@deepseek-ai/dsh':HARN_VERSION}}));
          let npm = path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'); if(!fs.existsSync(npm))throw Error('npm must be installed beside Node.');
          await run(process.execPath,[npm,'install','--no-fund','--no-audit'],emit,{cwd:install});await harnessPatch();output('Official DeepSeek Harness installed locally. Type harness configure.');break;
        }
        if(!fs.existsSync(binary))throw Error('Run harness install first.');
        if(sub==='status'){output(`CLI ${HARN_VERSION}\nHome ${home}\nWeb ${state.harness?.url||'stopped'}\nSession ${state.session||'new'}\nResource access: ${settings.harnessAccess||'full'} (OS account permissions still apply)`);break;}
        if(sub==='new'){state.session=null;settings.sessionId=null;await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));output('Next ask starts a new conversation.');break;}
        if(sub==='resume'){state.session=requireArg(a[0]);settings.sessionId=state.session;await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));output('Selected persisted session '+state.session+'. The CLI will verify it on the next ask.');break;}
        if(sub==='model'){const provider=requireArg(a[0]),model=requireArg(a[1]);if(!['deepseek-official','deepseek-account'].includes(provider))throw Error('Provider must be deepseek-official or deepseek-account.');settings.provider=provider;settings.model=model;state.session=null;settings.sessionId=null;await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));await harnessPatch();output(`Selected ${settings.provider}/${settings.model}. Next ask starts a new conversation.`);break;}
        if(sub==='stop'){kill(state.harness?.child);state.harness=null;output('Harness web stopped.');break;}
        if(sub==='configure'||sub==='web') {
          if(!state.harness){await harnessPatch();const p=validPort(a[0]||4318);await portAvailable(p);const child=spawn(process.execPath,[binary,'web','--host','127.0.0.1','--port',String(p),'--no-open'],{cwd:root,env:harnessEnv(),windowsHide:true,stdio:['ignore','pipe','pipe']});const url=`http://127.0.0.1:${p}/`;state.harness={child,url};try{state.harness.authUrl=await waitHarness(child,p,emit);}catch(error){kill(child);state.harness=null;throw error;}child.on('exit',()=>{if(state.harness?.child===child)state.harness=null;});}
          output('Open the official UI: Settings > Models for API Key, or the account sign-in entry. Select this blog folder as workspace.');emit({type:'link',url:state.harness.authUrl});break;
        }
        if(sub==='help'){await run(process.execPath,[binary,'--profile','headless','--help'],emit);break;}
        if(sub==='ask') {
          const prompt=requireArg(payload.prompt || a.join(' '));await harnessPatch();
          const args=[binary,'--profile','headless','--json'];if(state.session)args.push('--session-id',state.session);args.push('-');
          const context='\n\nLocal resource locations:\n'+[...state.roots].map(([name,dir])=>name+': '+dir).join('\n');
          output(`Running official Harness. Resource access: ${settings.harnessAccess||'full'}.`);try{await run(process.execPath,args,emit,{json:true,input:prompt+context,env:harnessEnv()});}finally{settings.sessionId=state.session;await fsp.writeFile(stateFile,JSON.stringify(settings,null,2));}break;
        }
        throw Error('Use harness install/configure/ask/new/resume/model/status/help/stop.');
      }
      default: throw Error(`Unknown command: ${cmd||'(empty)'}. Type help.`);
    }
  }
  async function waitServer(child,p,emit,limit=20000) {
    let errors='';child.stdout.on('data',text=>emit({type:'output',text:text.toString()}));child.stderr.on('data',text=>{errors+=text.toString();emit({type:'output',text:text.toString()});});
    const end=Date.now()+limit;
    while(Date.now()<end){if(child.exitCode!==null)throw Error('Server exited before starting. '+errors.slice(-500));try{const r=await fetch(`http://127.0.0.1:${p}/`,{signal:AbortSignal.timeout(700)});if(r.status<500)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
    kill(child);throw Error('Server startup timed out.');
  }
  async function waitHarness(child,p,emit) {
    // dsh's root requires its private launch-token URL. Do not announce an unauthenticated root.
    return new Promise((resolve,reject)=>{
      let buffer='';const timer=setTimeout(()=>reject(Error('Harness startup timed out.')),120000);
      child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
      child.stdout.on('data',text=>{
        buffer+=text;const lines=buffer.split('\n');buffer=lines.pop();
        for(const line of lines){const match=line.match(/^dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s]+)/);
          if(match){const auth=new URL(match[1]);if(auth.port!==String(p))continue;clearTimeout(timer);emit({type:'output',text:'Official Harness web ready.\n'});resolve(auth.href);}
          else emit({type:'output',text:line+'\n'});
        }
      });
      child.stderr.on('data',text=>emit({type:'output',text:text.replace(/sk-[a-zA-Z0-9_-]+/g,'[redacted key]')}));
      child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Harness web exited (${code}) before it was ready.`));});
    });
  }
  async function body(req,limit=EDIT_LIMIT){let n=0;const chunks=[];for await(const part of req){n+=part.length;if(n>limit)throw Error('Request exceeds size limit.');chunks.push(part);}return Buffer.concat(chunks);}
  const allowedOrigin = origin => {
    if(origin==='https://chadoshamot.github.io')return true;
    try{const u=new URL(origin);return u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}
  };
  const server = http.createServer(async(req,res)=>{
    const send=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try{
      const authority=`127.0.0.1:${server.address().port}`;
      if(![authority,`localhost:${server.address().port}`].includes(req.headers.host))return send(403,{error:'Invalid Host.'});
      const origin=req.headers.origin;
      if(origin&&!allowedOrigin(origin))return send(403,{error:'Origin is not allowed.'});
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      const url=new URL(req.url,'http://'+authority);
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Shamot-Path, X-Shamot-Overwrite','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'600'});return res.end();}
      if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/pair')){
        if(origin&&origin!==`http://${req.headers.host}`)return send(403,{error:'Open this address in a separate local tab.'});
        res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(`<title>shamot · Local pairing</title><style>body{background:#2A486E;color:#e4eaf1;max-width:850px;margin:10vh auto;padding:24px;font:18px/1.7 system-ui}code{display:block;overflow-wrap:anywhere;padding:24px;background:#233c5b}a{color:#f1d18b}</style><h1>shamot / Local bridge</h1><p>Open your blog, enter ↑ ↑ ↓ ↓ ← → ← → B A B A, then paste:</p><code>connect http://${authority} ${pairCode}</code><p>The pairing code rotates after a successful connection. Only share it with your own browser.</p><p><a href="/console">Open the local console</a> · <a href="https://chadoshamot.github.io/">Open blog</a></p>`);
      }
      if(req.method==='GET'&&url.pathname==='/console'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' http://127.0.0.1:*; frame-ancestors 'none'"});return res.end('<!doctype html><html data-palette="navy" data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>shamot Local Console</title><link rel="stylesheet" href="/assets/shamot-terminal.css"><body><main><p>Press ↑ ↑ ↓ ↓ ← → ← → B A B A using your physical keyboard.</p></main><script src="/assets/shamot-terminal.js" defer></script></body></html>');
      }
      if(req.method==='GET'&&['/assets/shamot-terminal.css','/assets/shamot-terminal.js','/assets/terminal-help.txt','/assets/terminal-help-zh.txt','/assets/pixel-cat.gif','/assets/pixel-cat-LICENSE.txt'].includes(url.pathname)){
        res.writeHead(200,{'Content-Type':url.pathname.endsWith('.gif')?'image/gif':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/plain; charset=utf-8'});return res.end(await fsp.readFile(path.join(ROOT,'source',url.pathname)));
      }
      if(req.method==='POST'&&url.pathname==='/api/pair'){
        const data=JSON.parse((await body(req,1024)).toString());
        if(typeof data.code!=='string'||data.code.length!==pairCode.length||!crypto.timingSafeEqual(Buffer.from(data.code),Buffer.from(pairCode)))return send(403,{error:'Invalid pairing code. Open /pair locally to get the current code.'});
        const token=crypto.randomBytes(32).toString('hex');tokens.set(token,Date.now()+12*60*60*1000);pairCode=crypto.randomBytes(18).toString('hex');return send(200,{token,root});
      }
      const token=(req.headers.authorization||'').replace(/^Bearer /,'');
      if(!tokens.has(token)||tokens.get(token)<Date.now())return send(401,{error:'Connect using the local pairing code first.'});
      if(req.method==='POST'&&url.pathname==='/api/cancel'){kill(state.job);return send(200,{ok:true});}
      if(req.method==='POST'&&url.pathname==='/api/disconnect'){tokens.delete(token);return send(200,{ok:true});}
      if(req.method==='GET'&&url.pathname==='/api/download'){
        const file=await resolveFile(url.searchParams.get('path'));const stat=await fsp.stat(file);if(!stat.isFile()||stat.size>MEDIA_LIMIT)throw Error('Download must be a file smaller than 64 MiB.');res.writeHead(200,{'Content-Type':'application/octet-stream'});return fs.createReadStream(file).pipe(res);
      }
      if(state.busy)return send(409,{error:'A command is running. Wait or use Ctrl+C.'});
      if(req.method==='POST'&&url.pathname==='/api/upload'){
        state.busy=true;try{const relative=decodeURIComponent(req.headers['x-shamot-path']||'');if(!relative.startsWith('source/'))throw Error('Upload to source/ only.');const file=await resolveFile('@site/'+relative,true);if(!within(path.join(root,'source'),file))throw Error('Upload must stay inside source/.');await put(file,await body(req,MEDIA_LIMIT),req.headers['x-shamot-overwrite']==='true');return send(200,{path:file});}finally{state.busy=false;}
      }
      if(req.method==='POST'&&url.pathname==='/api/save'){
        state.busy=true;try{const data=JSON.parse((await body(req,EDIT_LIMIT*2)).toString());const file=await resolveFile(data.path,true);if(fs.existsSync(file)){const hash=crypto.createHash('sha256').update(await fsp.readFile(file)).digest('hex');if(hash!==data.hash)throw Error('File changed since opening. Reopen it before saving.');}if(typeof data.text!=='string'||Buffer.byteLength(data.text)>EDIT_LIMIT)throw Error('Text limit: 4 MiB.');if(file===aboutFile)about.parse(data.text);if(file===friendsFile)friends.parse(data.text);await put(file,data.text,true);return send(200,{hash:crypto.createHash('sha256').update(data.text).digest('hex')});}finally{state.busy=false;}
      }
      if(req.method==='POST'&&url.pathname==='/api/command'){
        const data=JSON.parse((await body(req,64000)).toString());if(typeof data.command!=='string')throw Error('Missing command.');if(data.prompt!==undefined&&typeof data.prompt!=='string')throw Error('Prompt must be text.');state.busy=true;
        res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8'});
        const emit=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
        try{await command(data.command,emit,data);emit({type:'done',ok:true,cwd:state.cwd});}catch(error){emit({type:'error',text:error.message});emit({type:'done',ok:false,cwd:state.cwd});}finally{state.busy=false;res.end();}return;
      }
      send(404,{error:'Not found.'});
    }catch(error){if(!res.headersSent)send(400,{error:error.message});else res.end();}
  });
  async function close(){kill(state.job);kill(state.preview?.child);kill(state.harness?.child);tokens.clear();await new Promise(resolve=>server.close(resolve));}
  return {server,close,state,command,port};
}
if(require.main===module){const arg=process.argv.indexOf('--port');const bridge=createBridge({port:arg>=0?process.argv[arg+1]:undefined});bridge.server.listen(bridge.port,'127.0.0.1',()=>console.log(`shamot bridge ready: http://127.0.0.1:${bridge.port}/pair\nOpen that local page to pair your website terminal.`));bridge.server.on('error',err=>{console.error(err.message);process.exitCode=1;});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await bridge.close();process.exit(0);});}
module.exports={createBridge,words,within};
