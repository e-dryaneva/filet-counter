const assert=require('node:assert/strict');
const UI=require('../scripts/ui-components.js');

// Menus must remain usable at either viewport edge and in a short landscape viewport.
for(const width of [360,412,768,1440])for(const height of [360,768]){
 for(const top of [16,height-60]){
  const p=UI.menuPlacement({left:width-80,top,bottom:top+44},280,400,{width,height});
  assert.ok(p.left>=16&&p.left+p.width<=width-16);
  assert.ok(p.top>=16&&p.top+Math.min(400,p.maxHeight)<=height-16);
 }
}
assert.equal(UI.nextIndex('ArrowDown',2,3),0);
assert.equal(UI.nextIndex('ArrowUp',0,3),2);
assert.equal(UI.nextIndex('ArrowUp',-1,3),2);
assert.equal(UI.nextIndex('End',0,3),2);
assert.equal(UI.nextIndex('ArrowDown',0,0),-1);
for(const bad of ['', ' ', '1', '2.5', '251', 'Infinity', 'abc'])assert.ok(UI.gridDimension(bad,250).error);
assert.equal(UI.gridDimension('250',250).value,250);
assert.equal(UI.gridDimension('300',300).value,300);

// Small DOM double: test actual event handlers, not a second implementation of them.
class Element{
 constructor(doc,text=''){this.ownerDocument=doc;this.textContent=text;this.attrs=new Map();this.listeners={};this.dataset={};this.style={};this.children=[];this.disabled=false;this.hidden=false;this.isConnected=true;this.classNames=new Set();this.classList={add:n=>this.classNames.add(n),contains:n=>this.classNames.has(n)};this.rect={left:20,right:240,top:80,bottom:124};}
 setAttribute(k,v){this.attrs.set(k,String(v));}
 getAttribute(k){return this.attrs.get(k)??null;}
 hasAttribute(k){return this.attrs.has(k);}
 removeAttribute(k){this.attrs.delete(k);if(k==='style')this.style={};}
 append(...els){for(const el of els){el.remove();el.parent=this;this.children.push(el);}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(el=>el!==this);this.parent=null;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 fire(type,init={}){const e={target:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...init};for(const fn of this.listeners[type]||[])fn(e);return e;}
 dispatchEvent(e){this['on'+e.type]?.(e);for(const fn of this.listeners[e.type]||[])fn(e);return !e.defaultPrevented;}
 focus(){this.ownerDocument.activeElement=this;}
 contains(el){return el===this||this.children.some(c=>c.contains(el));}
 getBoundingClientRect(){return this.rect;}
 querySelectorAll(){return this.children;}
 closest(){return this;}
 after(el){this.ownerDocument.nodes.set(el.id,el);}
 matches(){return this.popoverOpen||false;}
 showPopover(){this.popoverOpen=true;}
 hidePopover(){this.popoverOpen=false;}
 showModal(){this.open=true;this.focus();}
 close(){this.open=false;if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;this.fire('close');}
}
const doc=new Element(null);doc.ownerDocument=doc;doc.nodes=new Map();doc.body=new Element(doc);doc.activeElement=doc.body;
doc.defaultView=new Element(doc);doc.defaultView.innerWidth=1024;doc.defaultView.innerHeight=768;
doc.getElementById=id=>doc.nodes.get(id);doc.createElement=()=>new Element(doc);
const button=new Element(doc);
UI.setBusy(button,true);UI.setBusy(button,true);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
UI.setBusy(button,false);assert.equal(button.disabled,false);assert.equal(button.hasAttribute('aria-busy'),false);
button.disabled=true;UI.setBusy(button,true);UI.setBusy(button,false);assert.equal(button.disabled,true);
const input=new Element(doc);input.id='cols';input.setAttribute('aria-describedby','help');
UI.fieldError(input,'Введи число');assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(input.getAttribute('aria-describedby'),'help colsError');
UI.fieldError(input,'');assert.equal(input.getAttribute('aria-describedby'),'help');assert.equal(doc.nodes.get('colsError').hidden,true);

const opener=new Element(doc),confirmCancel=new Element(doc),dialog=new Element(doc),nested=new Element(doc);
opener.focus();doc.body.style.overflow='auto';UI.openDialog(dialog,{focus:confirmCancel,dismissible:true});
assert.equal(doc.activeElement,confirmCancel);assert.equal(doc.body.style.overflow,'hidden');
UI.openDialog(nested);dialog.close();assert.equal(doc.body.style.overflow,'hidden','One modal still open');nested.close();assert.equal(doc.body.style.overflow,'auto','Original body overflow restored');
opener.focus();UI.openDialog(dialog,{dismissible:true});dialog.close();assert.equal(doc.activeElement,opener,'Return focus to opener');
UI.openDialog(dialog,{dismissible:true});dialog.addEventListener('cancel',e=>e.preventDefault());
dialog.fire('pointerdown',{clientX:0,clientY:0});dialog.fire('click',{clientX:0,clientY:0});assert.equal(dialog.open,true,'Prevented dismissal must preserve modal');dialog.close();
UI.openDialog(nested,{dismissible:false});nested.fire('pointerdown',{clientX:0,clientY:0});nested.fire('click',{clientX:0,clientY:0});assert.equal(nested.open,true,'Working editor does not close on backdrop');nested.close();

function makeMenu(kind){
 const menu=new Element(doc);menu.classNames.add(kind);menu.open=false;
 const trigger=new Element(doc,'Порядок'),panel=new Element(doc);panel.offsetWidth=250;panel.scrollHeight=200;
 const options=['Недавно вязала','Недавно добавила','По названию'].map(t=>new Element(doc,t));
 const input=kind==='filter-picker'?new Element(doc):null;
 if(input){input.value='added';options.forEach((b,i)=>{b.dataset.value=['active','added','name'][i];b.setAttribute('data-value',b.dataset.value);});}
 panel.append(...options);menu.append(trigger,panel);if(input)menu.append(input);
 menu.querySelector=q=>q==='summary'?trigger:q==='input[type=hidden]'?input:panel;
 return {menu,trigger,panel,options,input};
}
const a=makeMenu('filter-picker'),b=makeMenu('pattern-menu');doc.children=[a.menu,b.menu];
const menus=UI.initMenus(doc);
assert.equal(a.options[1].getAttribute('aria-checked'),'true');a.trigger.focus();
a.menu.fire('keydown',{target:a.trigger,key:'Enter'});a.menu.fire('toggle');
assert.equal(a.menu.open,true);assert.equal(a.panel.popoverOpen,true);assert.equal(doc.activeElement,a.options[1]);
assert.equal(a.trigger.getAttribute('aria-expanded'),'true');assert.equal(a.options[1].getAttribute('role'),'menuitemradio');
a.menu.fire('keydown',{target:a.options[1],key:'End'});assert.equal(doc.activeElement,a.options[2]);
a.menu.fire('keydown',{target:a.options[2],key:'ArrowDown'});assert.equal(doc.activeElement,a.options[0]);
a.menu.fire('keydown',{target:a.options[0],key:'п'});assert.equal(doc.activeElement,a.options[2]);
a.menu.fire('keydown',{target:a.options[2],key:'Escape'});assert.equal(a.menu.open,false);assert.equal(a.panel.popoverOpen,false);assert.equal(doc.activeElement,a.trigger);
a.menu.open=true;a.menu.fire('toggle');b.menu.open=true;b.menu.fire('toggle');assert.equal(a.menu.open,false,'Only one menu open across component families');
doc.fire('scroll',{target:b.panel});assert.equal(b.menu.open,true,'Scrolling inside menu keeps it open');doc.fire('scroll',{target:doc});assert.equal(b.menu.open,false);
b.menu.open=true;b.menu.fire('toggle');UI.openDialog(dialog,{focus:confirmCancel});b.panel.fire('click',{target:b.options[0]});assert.equal(doc.activeElement,confirmCancel,'Menu action must not steal focus from new dialog');dialog.close();
a.menu.open=true;a.menu.fire('toggle');doc.fire('pointerdown',{target:doc.body});assert.equal(a.menu.open,false);
menus.closeAll();
let changes=0;a.input.onchange=()=>changes++;
a.trigger.fire('click');a.menu.fire('toggle');a.panel.fire('click',{target:a.options[2]});
assert.equal(a.input.value,'name');assert.equal(changes,1);assert.equal(a.options[2].getAttribute('aria-checked'),'true');assert.equal(a.options[1].getAttribute('aria-checked'),'false');assert.equal(a.menu.open,false);
a.trigger.fire('click');a.menu.fire('toggle');assert.equal(a.options[2].getAttribute('aria-checked'),'true','Selection persists on reopen');menus.closeAll();
// Same nodes and selection in mobile modal; scrolling inside must not dismiss it.
doc.defaultView.innerWidth=393;a.trigger.fire('click');a.menu.fire('toggle');
const sheet=doc.body.children.find(el=>el.className==='app-dialog menu-sheet');
assert.ok(sheet.open);assert.ok(sheet.contains(a.panel));assert.equal(a.panel.hasAttribute('popover'),false);assert.equal(doc.body.style.overflow,'hidden');assert.equal(doc.activeElement,a.options[2]);
doc.fire('scroll',{target:a.panel});assert.equal(sheet.open,true);
a.panel.fire('click',{target:a.options[0]});assert.equal(a.input.value,'active');assert.equal(changes,2);assert.equal(sheet.open,false);assert.ok(a.menu.contains(a.panel));assert.equal(doc.body.style.overflow,'auto');assert.equal(doc.activeElement,a.trigger);
a.trigger.fire('click');a.menu.fire('toggle');sheet.fire('keydown',{target:a.options[0],key:'Escape'});assert.equal(sheet.open,false);assert.equal(doc.activeElement,a.trigger);
a.trigger.fire('click');a.menu.fire('toggle');doc.defaultView.innerWidth=1024;doc.defaultView.fire('resize');assert.equal(sheet.open,false);assert.equal(a.menu.open,false);
a.input.value='added';menus.syncSelections();assert.equal(a.options[1].getAttribute('aria-checked'),'true');
console.log('PASS: selection/checkmarks persist, mobile sheet uses same options, focus/dismissal/scroll locks, desktop bounds, keyboard, validation and loading');
