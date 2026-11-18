const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../scripts/offline.js'),'utf8');
async function setup(controlled=true){
 const events={},timers=new Map();let timerId=0,reloads=0,checks=0,saves=0,safe=true,saveOK=true;
 const document={hidden:false,addEventListener:(name,fn)=>events[name]=fn};
 const serviceWorker={controller:controlled?{}:null,addEventListener:(name,fn)=>events[name]=fn,register:async()=>({update:async()=>{checks++;}}),ready:Promise.resolve()};
 const location={protocol:'https:',reload:()=>reloads++};
 const window={isSecureContext:true,addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(source,{window,document,location,navigator:{serviceWorker},localStorage:{getItem:()=>true},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{events.poll=fn;}});
 await window.FiletOffline.start(()=>{},async()=>{saves++;return saveOK;},()=>safe);
 return {events,document,run:async()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn();},safe:v=>safe=v,saveOK:v=>saveOK=v,state:()=>({reloads,checks,saves})};
}
(async()=>{
 const s=await setup();s.safe(false);s.events.controllerchange();await s.run();assert.equal(s.state().reloads,0,'No reload while knitting/editing');
 s.safe(true);s.events['filet:screenchange']();await s.run();assert.equal(s.state().reloads,1,'Return to library updates automatically');assert.equal(s.state().saves,1);
 const failed=await setup();failed.saveOK(false);failed.events.controllerchange();await failed.run();assert.equal(failed.state().reloads,0,'Save failure prevents reload');failed.saveOK(true);failed.events.focus();await failed.run();assert.equal(failed.state().reloads,1);
 const hidden=await setup();hidden.document.hidden=true;hidden.events.controllerchange();await hidden.run();assert.equal(hidden.state().reloads,0);hidden.document.hidden=false;hidden.events.visibilitychange();await hidden.run();assert.equal(hidden.state().reloads,1);
 const first=await setup(false);first.events.controllerchange();await first.run();assert.equal(first.state().reloads,0,'First install has no reload loop');first.events.controllerchange();await first.run();assert.equal(first.state().reloads,1,'Later release updates');
 console.log('PASS: automatic updates, active-work deferral, save failures, hidden tabs and first install');
})().catch(e=>{console.error(e);process.exitCode=1;});
