const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../scripts/update.js'),'utf8'),{window,setTimeout,clearTimeout,Error});
function worker(state='installed'){
 const listeners=new Set();return {state,messages:[],addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),postMessage(message){this.messages.push(message);},change(state){this.state=state;for(const fn of [...listeners])fn();}};
}
(async()=>{
 const w=worker(),reg={waiting:w};
 await assert.rejects(window.FiletUpdate.activate(reg,async()=>false),/Сначала сохрани/);assert.equal(w.messages.length,0,'Save failure never activates');
 let saved=false;const apply=window.FiletUpdate.activate(reg,async()=>{saved=true;return true;});
 await new Promise(setImmediate);assert(saved);assert.equal(w.messages[0].type,'FILET_ACTIVATE_UPDATE');
 w.change('activated');await apply;
 const failed=worker();const failure=window.FiletUpdate.activate({waiting:failed});await new Promise(setImmediate);failed.change('redundant');await assert.rejects(failure,/не установилось/);
 const installing=worker('installing');const install=window.FiletUpdate.waitForInstall({installing});installing.change('installed');await install;
 const bad=worker('installing');const badInstall=window.FiletUpdate.waitForInstall({installing:bad});bad.change('redundant');await assert.rejects(badInstall,/Не удалось загрузить/);
 await window.FiletUpdate.activate({active:worker('activated')});
 console.log('PASS: explicit activation, save guard, installation and retryable failures');
})().catch(e=>{console.error(e);process.exitCode=1;});
