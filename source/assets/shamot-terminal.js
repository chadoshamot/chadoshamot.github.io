(() => {
  'use strict';
  if (window.shamotTerminal) return;
  const assetRoot = new URL('.', document.currentScript.src);
  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a','b','a'];
  const available = ['help','connect','disconnect','clear','exit','theme','pwd','ls','cd','mount','read','edit','download','remove','new','import','asset','upload','posts','projects','search','config','status','changes','git','preview','build','publish','bridge','shell','harness'];
  let progress=0,lastKey=0,dialog,output,input,status,editor,editing=null,pad,padProgress;
  let busy=false,history=[],cursor=0,session=null;
  try { session=JSON.parse(sessionStorage.getItem('shamot.bridge') || 'null'); } catch {}
  const storage = () => {try{if(session)sessionStorage.setItem('shamot.bridge',JSON.stringify(session));else sessionStorage.removeItem('shamot.bridge');}catch{}};
  function print(text,kind='') { const p=document.createElement('p');p.className=kind;p.textContent=text;output.append(p);while(output.children.length>350)output.firstChild.remove();output.scrollTop=output.scrollHeight; }
  function link(url,label='Open in a new tab') {let parsed;try{parsed=new URL(url);}catch{return;}if(!['http:','https:'].includes(parsed.protocol))return;const p=document.createElement('p'),a=document.createElement('a');a.href=parsed.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label+' → '+parsed.origin+parsed.pathname;p.append(a);output.append(p);output.scrollTop=output.scrollHeight;}
  function connectionState() {if(status)status.textContent=session?'paired · local computer':'offline · help available';}
  function setBusy(value) {busy=value;dialog.querySelector('[data-term=run]').disabled=value;input.placeholder=value?'Running… Ctrl+C to cancel':'Type help';}
  async function api(route,options={}) {
    if(!session)throw Error('Not connected. Open http://127.0.0.1:4317/pair and paste its connect command.');
    const headers={Authorization:'Bearer '+session.token,...options.headers};
    const response=await fetch(session.url+route,{...options,headers});
    if(!response.ok){const error=await response.json().catch(()=>({error:'Request failed.'}));if(response.status===401){session=null;storage();connectionState();}throw Error(error.error||`HTTP ${response.status}`);}return response;
  }
  async function help(keyword) {const text=await (await fetch(new URL('terminal-help.txt',assetRoot))).text();print(keyword?text.split('\n').filter((line,i,all)=>line.toLowerCase().includes(keyword.toLowerCase())||(i>0&&all[i-1].toLowerCase().includes(keyword.toLowerCase()))).join('\n')||'No help match. Type help.':text);}
  async function handle(event) {
    if(event.type==='output')print(event.text);
    if(event.type==='error')print(event.text,'term-error');
    if(event.type==='link')link(event.url);
    if(event.type==='editor'){editing=event;editor.classList.add('is-open');editor.querySelector('header span').textContent=event.path;editor.querySelector('textarea').value=event.text;editor.querySelector('textarea').focus();}
    if(event.type==='download'){const blob=await (await api('/api/download?path='+encodeURIComponent(event.path))).blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=event.path.split(/[\\/]/).pop();a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
    if(event.type==='harness'){const e=event.event;if(e.type==='session')print('Harness session: '+(e.sessionId||e.id||JSON.stringify(e)));else if(e.type==='final')print(e.text||e.answer||'Task finished.');else if(e.type==='text'||e.type==='thinking')print((e.type==='thinking'?'[thinking] ':'')+(e.text||JSON.stringify(e)));else print('[harness] '+JSON.stringify(e));}
  }
  async function execute(line) {
    line=line.trim();if(!line)return;if(busy){print('A command is running. Use Ctrl+C to cancel.','term-error');return;}
    const cmd=line.split(/\s/)[0],tail=line.slice(cmd.length).trim();
    print('shamot > '+(cmd==='connect'?'connect [pairing code hidden]':line),'term-command');
    if(cmd!=='connect'){history.push(line);history=history.slice(-100);}cursor=history.length;
    setBusy(true);
    try {
      if(cmd==='help'){await help(tail);return;}
      if(cmd==='clear'){output.replaceChildren();return;}
      if(cmd==='exit'){dialog.close();return;}
      if(cmd==='theme'){if(!['beige','navy','green'].includes(tail))throw Error('Use theme beige, theme navy or theme green.');if(window.setShamotPalette)window.setShamotPalette(tail);else {document.documentElement.dataset.palette=tail;document.documentElement.dataset.theme=tail==='beige'?'light':'dark';}print('Palette: '+tail);return;}
      if(cmd==='connect'){
        const match=tail.match(/^(https?:\/\/[^\s]+)\s+([a-f0-9]+)$/i);if(!match)throw Error('Use connect http://127.0.0.1:4317 PAIR_CODE.');
        const url=new URL(match[1]);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('Connect to a loopback HTTP address only.');
        const response=await fetch(url.origin+'/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:match[2]})});const data=await response.json();if(!response.ok)throw Error(data.error);session={url:url.origin,token:data.token};storage();connectionState();print('Paired with '+data.root+'. Type status or help.');return;
      }
      if(cmd==='disconnect'){if(session)await api('/api/disconnect',{method:'POST'});session=null;storage();connectionState();print('Disconnected.');return;}
      if(cmd==='upload'){if(!session)throw Error('Connect before uploading.');dialog.querySelector('.shamot-upload-picker').click();return;}
      const response=await api('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:line})});
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
      while(true){const result=await reader.read();buffer+=decoder.decode(result.value||new Uint8Array(),{stream:!result.done});const lines=buffer.split('\n');buffer=lines.pop();for(const text of lines)if(text.trim())await handle(JSON.parse(text));if(result.done){if(buffer.trim())await handle(JSON.parse(buffer));break;}}
    }catch(error){print(error.message==='Failed to fetch'?'Cannot reach the local bridge. Start it, allow Local Network Access, or open http://127.0.0.1:4317/console.':error.message,'term-error');}
    finally{setBusy(false);if(!editing)input.focus();}
  }
  async function cancel(){try{await api('/api/cancel',{method:'POST'});print('Cancellation requested.');}catch(e){print(e.message,'term-error');}}
  function createDialog(){
    dialog=document.createElement('dialog');dialog.className='shamot-terminal';dialog.setAttribute('aria-label','shamot owner terminal');
    dialog.innerHTML='<header class="shamot-term-top"><span class="shamot-term-title">shamot / terminal</span><span class="shamot-term-status"></span><button type="button" data-term="cancel">Stop</button><button type="button" class="shamot-term-close" aria-label="Close terminal">×</button></header><div class="shamot-term-output" role="log" aria-label="Terminal output" tabindex="0"></div><section class="shamot-term-editor"><header><span></span><button type="button" data-term="save">Save</button><button type="button" data-term="editor-close">Close editor</button></header><textarea aria-label="File contents" spellcheck="false"></textarea></section><form class="shamot-term-form"><label for="shamot-command">shamot &gt;</label><input id="shamot-command" autocomplete="off" spellcheck="false" aria-label="English command" placeholder="Type help"><button data-term="run" type="submit">Run</button></form><footer class="shamot-term-foot"><span>↑ ↓ history · Tab complete · Ctrl+C stop</span><a target="_blank" rel="noopener" href="'+new URL('terminal-help.txt',assetRoot).href+'">Handbook ↗</a></footer><input class="shamot-upload-picker" type="file" multiple>';
    document.body.append(dialog);output=dialog.querySelector('.shamot-term-output');input=dialog.querySelector('input:not([type=file])');status=dialog.querySelector('.shamot-term-status');editor=dialog.querySelector('.shamot-term-editor');connectionState();
    dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const line=input.value;input.value='';execute(line);});
    dialog.querySelector('.shamot-term-close').onclick=()=>dialog.close();dialog.querySelector('[data-term=cancel]').onclick=cancel;
    dialog.querySelector('[data-term=editor-close]').onclick=()=>{editing=null;editor.classList.remove('is-open');input.focus();};
    dialog.querySelector('[data-term=save]').onclick=async()=>{if(!editing||busy)return;const button=dialog.querySelector('[data-term=save]');button.disabled=true;try{const response=await api('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:editing.path,hash:editing.hash,text:editor.querySelector('textarea').value})});editing.hash=(await response.json()).hash;print('Saved '+editing.path);}catch(e){print(e.message,'term-error');}finally{button.disabled=false;}};
    input.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();cursor=Math.max(0,Math.min(history.length,cursor+(e.key==='ArrowUp'?-1:1)));input.value=history[cursor]||'';}if(e.key==='Tab'&&!input.value.includes(' ')){e.preventDefault();const choices=available.filter(c=>c.startsWith(input.value));if(choices.length===1)input.value=choices[0]+' ';else print(choices.join('  '));}});
    dialog.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='c'&&busy){e.preventDefault();cancel();}});
    dialog.querySelector('[type=file]').onchange=async event=>{for(const file of event.target.files){const suggestion=file.name.toLowerCase().endsWith('.md')?'source/_posts/'+file.name:'source/assets/uploads/'+file.name;const dest=window.prompt('Upload destination (inside source/):',suggestion);if(!dest)continue;try{setBusy(true);const response=await api('/api/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Shamot-Path':encodeURIComponent(dest)},body:file});const result=await response.json();print('Uploaded '+result.path+'. Use edit for Markdown front matter, then preview/build.');}catch(e){print(e.message,'term-error');}finally{setBusy(false);}}event.target.value='';};
    print('Owner terminal ready. Type help.\nLocal resources require the companion bridge.\nPairing: open http://127.0.0.1:4317/pair in a separate tab.');link('http://127.0.0.1:4317/pair','Get local pairing code');
  }
  function open(){if(!dialog)createDialog();if(pad?.open)pad.close();if(!dialog.open)dialog.showModal();input.focus();}
  function feed(key){const now=Date.now();if(now-lastKey>12000)progress=0;lastKey=now;const normalized=key.length===1?key.toLowerCase():key;if(normalized===sequence[progress])progress++;else progress=normalized===sequence[0]?1:0;if(padProgress)padProgress.textContent='●'.repeat(progress)+'○'.repeat(sequence.length-progress);if(progress===sequence.length){progress=0;open();}}
  function codePad(){if(!pad){pad=document.createElement('dialog');pad.className='shamot-codepad';pad.setAttribute('aria-label','Secret key sequence');pad.innerHTML='<p>Enter your key sequence</p><div class="shamot-code-progress"></div><div class="shamot-codekeys"><button data-key="ArrowUp">↑</button><button data-key="ArrowDown">↓</button><button data-key="ArrowLeft">←</button><button data-key="ArrowRight">→</button><button data-key="b">B</button><button data-key="a">A</button></div><button data-close>Close</button>';document.body.append(pad);padProgress=pad.querySelector('.shamot-code-progress');pad.querySelectorAll('[data-key]').forEach(button=>button.onclick=()=>feed(button.dataset.key));pad.querySelector('[data-close]').onclick=()=>pad.close();}progress=0;padProgress.textContent='○'.repeat(sequence.length);if(!pad.open)pad.showModal();}
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.closest('input,textarea,[contenteditable=true]')||dialog?.open)return;if(sequence.includes(e.key)||sequence.includes(e.key.toLowerCase())){e.preventDefault();feed(e.key);}else progress=0;});
  function launcher(){if(document.querySelector('.shamot-terminal-launch'))return;const button=document.createElement('button');button.type='button';button.className='shamot-terminal-launch';button.setAttribute('aria-label','Open secret keyboard');button.title='Keyboard';button.textContent='⌨';button.onclick=codePad;(document.querySelector('.page-footer')||document.querySelector('main')||document.body).append(button);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',launcher);else launcher();
  document.addEventListener('stellar:navigation-complete',launcher);
  window.shamotTerminal={open,execute};
})();
