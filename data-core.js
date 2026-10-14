(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MufDataCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIVE='mfkr-active-account-v1', PREFIX='mfkr-account-v1:';
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function openAccountStorage(raw){
    let owner=raw.getItem(ACTIVE)||'guest';
    const prefix=id=>PREFIX+encodeURIComponent(id)+':';
    const owned=key=>typeof key==='string'&&key.startsWith('h2do-');
    const nativeKeys=()=>Array.from({length:raw.length},(_,i)=>raw.key(i)).filter(Boolean);
    // Upgrade the pre-account store once. Never replace an existing account value.
    const legacy=nativeKeys().filter(owned);
    legacy.forEach(key=>{if(raw.getItem(prefix(owner)+key)===null)raw.setItem(prefix(owner)+key,raw.getItem(key));});
    legacy.forEach(key=>raw.removeItem(key));
    raw.setItem(ACTIVE,owner);
    const keyFor=key=>owned(String(key))?prefix(owner)+String(key):String(key);
    const visibleKeys=()=>nativeKeys().flatMap(key=>key.startsWith(prefix(owner))?[key.slice(prefix(owner).length)]:key.startsWith(PREFIX)||key===ACTIVE?[]:[key]);
    const storage={get length(){return visibleKeys().length;},key:i=>visibleKeys()[i]??null,
      getItem:key=>raw.getItem(keyFor(key)),setItem:(key,value)=>raw.setItem(keyFor(key),String(value)),removeItem:key=>raw.removeItem(keyFor(key)),clear:()=>visibleKeys().forEach(key=>raw.removeItem(keyFor(key)))};
    function activate(uid){
      const target=uid?String(uid):'guest';
      if(target===owner)return {reload:false};
      const targetKeys=nativeKeys().filter(key=>key.startsWith(prefix(target)));
      // First sign-in may adopt anonymous work. Signing out never copies private data to guest.
      if(owner==='guest'&&target!=='guest'&&!targetKeys.length){
        const guestKeys=nativeKeys().filter(key=>key.startsWith(prefix(owner)));
        guestKeys.forEach(key=>raw.setItem(prefix(target)+key.slice(prefix(owner).length),raw.getItem(key)));
        raw.setItem(ACTIVE,target);
        guestKeys.forEach(key=>raw.removeItem(key));
        owner=target;
        return {reload:false,adoptedGuest:true};
      }
      raw.setItem(ACTIVE,target);
      // The old facade deliberately remains bound to its old owner until the document reloads.
      return {reload:true};
    }
    return {storage,activate,get owner(){return owner;}};
  }
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function record(v){return v&&typeof v==='object'&&!Array.isArray(v);}
  function mergeChanges(base,local,remote){
    if(equal(base,local))return copy(remote);
    if(Array.isArray(base)&&Array.isArray(local)&&Array.isArray(remote)){
      const identified=base.concat(local,remote).every(v=>record(v)&&typeof v.id==='string');
      if(identified){
        const before=new Map(base.map(v=>[v.id,v])),after=new Map(local.map(v=>[v.id,v])),cloud=new Map(remote.map(v=>[v.id,v]));
        const deleted=new Set(base.filter(v=>!after.has(v.id)).map(v=>v.id));
        const order=[...new Set(local.map(v=>v.id).concat(remote.map(v=>v.id)))];
        return order.filter(id=>!deleted.has(id)).map(id=>after.has(id)?mergeChanges(before.get(id),after.get(id),cloud.get(id)):copy(cloud.get(id))).filter(Boolean);
      }
      if(base.length===local.length&&base.every(v=>!record(v))&&local.every(v=>!record(v))){
        const out=copy(remote);local.forEach((v,i)=>{if(!equal(v,base[i]))out[i]=copy(v);});return out;
      }
      return copy(local);
    }
    if(record(local)&&(!base||record(base))&&(!remote||record(remote))){
      const out=copy(remote)||{};
      new Set(Object.keys(base||{}).concat(Object.keys(local))).forEach(key=>{
        if(!Object.prototype.hasOwnProperty.call(local,key)){if(base&&Object.prototype.hasOwnProperty.call(base,key))delete out[key];return;}
        if(!equal((base||{})[key],local[key]))out[key]=mergeChanges((base||{})[key],local[key],(remote||{})[key]);
      });return out;
    }
    return copy(local);
  }
  return {openAccountStorage,mergeChanges};
});
