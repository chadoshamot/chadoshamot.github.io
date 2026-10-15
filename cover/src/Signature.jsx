import React,{useEffect,useId,useRef,useState} from 'react';

// Pen routes traced against Great Vibes at 400 units, baseline 360.
// The routes reveal the original font, rather than replacing its letterforms.
const strokes=[
 ['M74 310 L119 228 Q137 195 158 207 C125 187 113 221 133 269 C161 327 127 367 91 356 C53 347 59 312 76 312 C51 349 96 376 156 347',640],
 ['M162 350 C198 280 257 126 291 124 L166 352 C194 308 251 246 291 240 C277 271 248 309 250 339 C252 375 295 355 319 314',800],
 ['M435 237 C416 205 372 229 346 266 C319 302 311 347 331 352 C361 363 407 293 433 257 C414 283 395 322 399 342 C405 367 434 354 452 320',700],
 ['M448 348 L509 234 M456 334 C486 285 541 236 567 239 C573 245 535 307 525 342 C537 314 588 258 640 239 C625 268 603 307 599 334 C591 375 636 354 665 312',850],
 ['M752 237 C721 207 681 254 668 296 C646 354 682 369 714 339 C747 310 773 257 752 237 M752 280 C731 281 747 333 783 313 C803 303 812 285 821 264',650],
 ['M878 156 C853 166 828 232 811 273 C796 312 792 354 818 353 C844 356 875 316 888 287',600],
 ['M810 212 L888 212',220],
];

export default function Signature({name='shamot',reduced=false,onComplete}){
 const id=useId().replace(/:/g,''),group=useRef(null);
 const [complete,setComplete]=useState(reduced||name!=='shamot');
 useEffect(()=>{if(complete)onComplete?.()},[complete,onComplete]);
 useEffect(()=>{
  if(reduced||name!=='shamot'){setComplete(true);return}
  let cancelled=false;const animations=[];
  const draw=async()=>{
   try{
    await document.fonts.load('400px "Shamot Script"');
    if(cancelled)return;
    let delay=550;
    for(const [i,path] of [...group.current.children].entries()){
     const duration=strokes[i][1];
     animations.push(path.animate([{strokeDashoffset:1},{strokeDashoffset:0}],{duration,delay,easing:'linear',fill:'forwards'}));
     delay+=duration-45;
    }
    await Promise.all(animations.map(animation=>animation.finished));
    if(!cancelled)setComplete(true);
   }catch{if(!cancelled)setComplete(true)}
  };
  draw();return()=>{cancelled=true;animations.forEach(animation=>animation.cancel())};
 },[name,reduced]);
 if(name!=='shamot')return <h1>{name}</h1>;
 return <h1 className="handwritten-name" aria-label={name} data-written={complete}>
  <svg viewBox="24 0 900 520" aria-hidden="true" focusable="false">
   <defs><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="520">
    <g ref={group} fill="none" stroke="white" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round">
     {strokes.map(([d],i)=><path key={i} d={d} pathLength="1" strokeDasharray="1 1" strokeDashoffset="1"/>)}
    </g>
   </mask></defs>
   <text x="60" y="360" mask={complete?undefined:`url(#${id})`}>shamot</text>
  </svg>
 </h1>;
}
