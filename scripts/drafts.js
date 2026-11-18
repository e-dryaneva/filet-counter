/* Independent local drafts. A legacy single draft is read until the first successful write. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FiletDrafts=api;})(globalThis,function(){
  'use strict';
  const key='filet.drafts.v1';
  function valid(d){return !!d&&d.version===1&&typeof d.name==='string'&&Number.isInteger(d.cols)&&d.cols>=2&&d.cols<=250&&Number.isInteger(d.rows)&&d.rows>=2&&d.rows<=300&&Array.isArray(d.cells)&&d.cells.length===d.rows&&d.cells.every(r=>typeof r==='string'&&r.length===d.cols&&/^[01]+$/.test(r));}
  function list(storage){
    const items=storage.get(key,null);
    if(items!==null){
      if(!Array.isArray(items)||!items.every(d=>valid(d)&&typeof d.id==='string'&&d.id)||new Set(items.map(d=>d.id)).size!==items.length)throw Error('Не удалось прочитать черновики.');
      return items;
    }
    const legacy=storage.get('filet.draft.v1',null);
    return valid(legacy)?[{...legacy,id:'legacy-draft',createdAt:legacy.updatedAt||0,updatedAt:legacy.updatedAt||0}]:[];
  }
  function put(storage,d){
    if(!valid(d)||typeof d.id!=='string'||!d.id)throw Error('Некорректный черновик.');
    const items=list(storage),index=items.findIndex(item=>item.id===d.id);
    if(index<0)items.push(d);else items[index]=d;
    return storage.set(key,items);
  }
  function remove(storage,id){return storage.set(key,list(storage).filter(d=>d.id!==id));}
  function merge(storage,incoming){
    const items=list(storage),ids=new Set(items.map(d=>d.id));
    for(const d of incoming){
      if(!valid(d)||typeof d.id!=='string'||!d.id)throw Error('Некорректный черновик.');
      if(!ids.has(d.id)){items.push(d);ids.add(d.id);}
    }
    return storage.set(key,items);
  }
  return {key,valid,list,put,remove,merge};
});
