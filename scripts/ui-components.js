/* Shared component behavior. No framework or network dependency. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FiletUI=api;
})(globalThis,function(){
  'use strict';
  function menuPlacement(anchor,width,height,viewport){
    const inset=16,gap=8,availableWidth=Math.max(0,viewport.width-inset*2);
    const w=Math.min(width,availableWidth);
    const below=Math.max(0,viewport.height-anchor.bottom-gap-inset),above=Math.max(0,anchor.top-gap-inset);
    const upward=height>below&&above>below,maxHeight=upward?above:below;
    return {left:Math.max(inset,Math.min(anchor.left,viewport.width-w-inset)),top:upward?Math.max(inset,anchor.top-gap-Math.min(height,maxHeight)):anchor.bottom+gap,width:w,maxHeight};
  }
  function nextIndex(key,index,length){
    if(!length)return -1;
    if(key==='Home')return 0;if(key==='End')return length-1;
    if(key==='ArrowDown')return (index+1+length)%length;
    if(key==='ArrowUp')return index<0?length-1:(index-1+length)%length;
    return index;
  }
  function gridDimension(value,max){
    const n=Number(value);
    return String(value).trim()!==''&&Number.isInteger(n)&&n>=2&&n<=max?{value:n,error:''}:{value:null,error:`Введи целое число от 2 до ${max}.`};
  }
  function fieldError(input,message){
    const doc=input.ownerDocument,id=input.id+'Error';let error=doc.getElementById(id);
    if(!error){error=doc.createElement('p');error.id=id;error.className='field-error';error.setAttribute('aria-live','polite');input.after(error);}
    if(error.textContent!==message)error.textContent=message;
    error.hidden=!message;input.setAttribute('aria-invalid',String(!!message));
    const descriptions=new Set((input.getAttribute('aria-describedby')||'').split(' ').filter(Boolean));
    if(message)descriptions.add(id);else descriptions.delete(id);
    if(descriptions.size)input.setAttribute('aria-describedby',[...descriptions].join(' '));else input.removeAttribute('aria-describedby');
  }
  const busyState=new WeakMap();
  function setBusy(button,busy){
    if(busy){if(busyState.has(button))return;busyState.set(button,button.disabled);button.disabled=true;button.setAttribute('aria-busy','true');}
    else if(busyState.has(button)){button.disabled=busyState.get(button);busyState.delete(button);button.removeAttribute('aria-busy');}
  }
  const dialogState=new WeakMap(),scrollLocks=new WeakMap();
  function openDialog(dialog,{focus=null,dismissible=false}={}){
    const doc=dialog.ownerDocument;
    if(dialog.open)return;
    const opener=dialog.returnFocus||doc.activeElement;
    dialog.showModal();
    const lock=scrollLocks.get(doc)||{overflow:doc.body.style.overflow,dialogs:new Set()};
    lock.dialogs.add(dialog);scrollLocks.set(doc,lock);
    const state={opener,dismissible};dialogState.set(dialog,state);
    doc.body.style.overflow='hidden';focus?.focus();
    if(dialog.dataset.uiDialog)return;
    dialog.dataset.uiDialog='true';let backdropDown=false;
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    dialog.addEventListener('pointerdown',e=>{backdropDown=outside(e);});
    dialog.addEventListener('click',e=>{if(backdropDown&&outside(e)&&dialogState.get(dialog)?.dismissible){dialog.dispatchEvent(new Event('cancel',{cancelable:true}))&&dialog.close();}backdropDown=false;});
    dialog.addEventListener('close',()=>{
      if(dialog.open)return;
      const current=dialogState.get(dialog);dialogState.delete(dialog);
      const lock=scrollLocks.get(doc);lock?.dialogs.delete(dialog);
      if(lock&&!lock.dialogs.size){doc.body.style.overflow=lock.overflow;scrollLocks.delete(doc);}
      if(current?.opener?.isConnected&&(doc.activeElement===doc.body||dialog.contains(doc.activeElement)))current.opener.focus({preventScroll:true});
    });
  }
  function initMenus(doc){
    let serial=0;const controllers=new Map();
    const isPopoverOpen=panel=>panel?.hasAttribute('popover')&&panel.matches(':popover-open');
    function syncSelection(c){
      if(!c?.input)return;
      for(const b of c.panel.querySelectorAll('button[data-value]'))b.setAttribute('aria-checked',String(b.dataset.value===c.input.value));
    }
    function syncSelections(){for(const c of controllers.values())syncSelection(c);}
    function close(menu,restore=false){
      const c=controllers.get(menu);if(!c)return;
      menu.open=false;c.summary.setAttribute('aria-expanded','false');
      if(isPopoverOpen(c.panel))c.panel.hidePopover();
      if(c.sheet?.open){c.sheet.close();}
      if(restore)c.summary.focus({preventScroll:true});
    }
    function closeAll(restore=false){for(const menu of controllers.keys())if(menu.open)close(menu,restore);}
    function sweep(){for(const [menu,c] of controllers)if(!menu.isConnected){if(c.sheet?.open)c.sheet.close();c.sheet?.remove();controllers.delete(menu);}}
    function bind(scope=doc){
      sweep();
      scope.querySelectorAll('.filter-picker,.backup-menu,.pattern-menu').forEach(menu=>{
        if(controllers.has(menu))return;
        const summary=menu.querySelector('summary'),panel=menu.querySelector('.filter-options,.backup-options,.menu-items');
        if(!summary||!panel)return;
        const options=()=>[...panel.querySelectorAll('button')].filter(b=>!b.disabled&&!b.hidden);
        panel.classList.add('ui-menu');panel.id ||= 'ui-menu-'+(++serial);panel.setAttribute('role','menu');panel.setAttribute('aria-label',summary.getAttribute('aria-label')||summary.textContent.trim());
        const canPopover=typeof panel.showPopover==='function';
        if(canPopover)panel.setAttribute('popover','manual');
        summary.setAttribute('aria-haspopup','menu');summary.setAttribute('aria-controls',panel.id);summary.setAttribute('aria-expanded','false');
        for(const b of options()){b.setAttribute('role',menu.classList.contains('filter-picker')?'menuitemradio':'menuitem');b.tabIndex=-1;if(b.hasAttribute('aria-pressed')){b.setAttribute('aria-checked',b.getAttribute('aria-pressed'));b.removeAttribute('aria-pressed');}}
        const c={summary,panel,input:menu.querySelector('input[type=hidden]'),sheet:null};
        controllers.set(menu,c);syncSelection(c);
        let search='',searchTime=0;
        const ensureSheet=()=>{
          if(c.sheet)return c.sheet;
          const sheet=doc.createElement('dialog'),header=doc.createElement('header'),title=doc.createElement('h2'),dismiss=doc.createElement('button');
          sheet.className='app-dialog menu-sheet';header.className='dialog-header';title.id=panel.id+'-title';title.textContent=panel.getAttribute('aria-label');
          sheet.setAttribute('aria-labelledby',title.id);dismiss.type='button';dismiss.dataset.appearance='flat';dismiss.setAttribute('aria-label','Закрыть');
          dismiss.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
          dismiss.onclick=()=>close(menu,true);header.append(title,dismiss);sheet.append(header);doc.body.append(sheet);c.sheet=sheet;
          sheet.addEventListener('close',()=>{
            if(sheet.open)return;
            menu.append(panel);if(canPopover)panel.setAttribute('popover','manual');
            menu.open=false;summary.setAttribute('aria-expanded','false');
          });
          sheet.addEventListener('keydown',onKey);return sheet;
        };
        const position=()=>{
          if(doc.defaultView.innerWidth<=700){
            if(c.sheet?.open)return;
            if(isPopoverOpen(panel))panel.hidePopover();panel.removeAttribute('popover');panel.removeAttribute('style');
            const sheet=ensureSheet();sheet.append(panel);sheet.returnFocus=summary;
            openDialog(sheet,{focus:options().find(b=>b.getAttribute('aria-checked')==='true')||options()[0],dismissible:true});return;
          }
          if(panel.hasAttribute('popover')&&!isPopoverOpen(panel))panel.showPopover();
          panel.style.maxHeight='none';panel.style.width='';
          const view=doc.defaultView,p=menuPlacement(summary.getBoundingClientRect(),panel.offsetWidth,panel.scrollHeight,{width:view.innerWidth,height:view.innerHeight});
          Object.assign(panel.style,{left:p.left+'px',top:p.top+'px',width:p.width+'px',maxHeight:p.maxHeight+'px'});
        };
        const open=()=>{sweep();closeAll();menu.open=true;summary.setAttribute('aria-expanded','true');syncSelection(c);position();};
        summary.addEventListener('click',e=>{e.preventDefault();if(menu.open)close(menu,true);else open();});
        menu.addEventListener('toggle',()=>{
          summary.setAttribute('aria-expanded',String(menu.open));
          if(menu.open){sweep();for(const other of controllers.keys())if(other!==menu&&other.open)close(other);position();}
          else if(isPopoverOpen(panel))panel.hidePopover();
        });
        function onKey(e){
          const list=options(),onTrigger=e.target===summary,index=list.indexOf(doc.activeElement);
          if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();close(menu,true);return;}
          if(e.key==='Tab'&&menu.open){if(c.sheet?.open)return;close(menu);summary.focus({preventScroll:true});return;}
          if(onTrigger&&['Enter',' '].includes(e.key)){e.preventDefault();if(menu.open){close(menu,true);return;}open();(list.find(b=>b.getAttribute('aria-checked')==='true')||list[0])?.focus({preventScroll:true});return;}
          if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
            e.preventDefault();if(!menu.open)open();list[nextIndex(e.key,index,list.length)]?.focus({preventScroll:true});return;
          }
          if(menu.open&&e.key.length===1&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key!==' '){
            const now=Date.now();search=now-searchTime>600?e.key:search+e.key;searchTime=now;
            const ordered=[...list.slice(index+1),...list.slice(0,index+1)];
            const match=ordered.find(b=>b.textContent.trim().toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));
            if(match){e.preventDefault();match.focus({preventScroll:true});}
          }
        }
        menu.addEventListener('keydown',onKey);
        panel.addEventListener('click',e=>{
          const button=e.target.closest('button');if(!button||!panel.contains(button)||button.disabled)return;
          if(c.input&&button.hasAttribute('data-value')){
            c.input.value=button.dataset.value;syncSelection(c);close(menu,true);
            c.input.dispatchEvent(new Event('change',{bubbles:true}));
          }else close(menu,menu.contains(doc.activeElement)||doc.activeElement===doc.body);
        });
      });
    }
    doc.addEventListener('pointerdown',e=>{for(const [menu,c] of controllers)if(menu.open&&!c.sheet?.open&&!menu.contains(e.target))close(menu);});
    doc.addEventListener('focusin',e=>{for(const [menu,c] of controllers)if(menu.open&&!c.sheet?.open&&!menu.contains(e.target))close(menu);});
    doc.addEventListener('scroll',e=>{for(const [menu,c] of controllers)if(menu.open&&!c.sheet?.open&&!c.panel.contains(e.target))close(menu);},true);
    doc.defaultView.addEventListener('resize',()=>closeAll());
    bind();return {bind,closeAll,syncSelections};
  }
  return {menuPlacement,nextIndex,gridDimension,fieldError,setBusy,openDialog,initMenus};
});
