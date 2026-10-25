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
        // A Friday reading session and its undo history form one state. Merging
        // their fields independently can combine completion with a partial range.
        if(key==='friday'&&record(local[key])){
          const friday=mergeChanges((base||{})[key],local[key],(remote||{})[key]);
          if(!equal(base?.friday?.kahf,local.friday.kahf)){
            if(Object.prototype.hasOwnProperty.call(local.friday,'kahf'))friday.kahf=copy(local.friday.kahf);
            else delete friday.kahf;
          }
          out[key]=friday;return;
        }
        if(key==='prayers'){
          const values=[(base||{})[key],local[key],(remote||{})[key]];
          if(values.every(v=>Array.isArray(v)&&[5,6].includes(v.length)&&v.every(x=>[true,false,'','ontime','late','missed'].includes(x)))){
            const normalized=values.map(v=>(v.length===5?[v[0],false,...v.slice(1)]:v).map(x=>x===true?'ontime':x||false));
            out[key]=mergeChanges(...normalized);return;
          }
        }
        if(!equal((base||{})[key],local[key]))out[key]=mergeChanges((base||{})[key],local[key],(remote||{})[key]);
      });return out;
    }
    return copy(local);
  }
  // Three-way learning reconciliation. Conflicts are returned, never silently committed.
  function reconcileLearning(base,local,remote){
    const merged=copy(remote||{}), conflicts=[], equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
    const fields=row=>Object.keys(row||{}).filter(k=>!['id','createdAt','updatedAt'].includes(k));
    const same=(a,b)=>[...new Set([...fields(a),...fields(b)])].every(k=>equal(a?.[k],b?.[k]));
    for(const key of ['schedule','preparations','courses','professionalReading','calendarOccurrences','subjects','activity','academicYears','terms']){
      const maps=[base,local,remote].map(d=>new Map((d?.[key]||[]).map(r=>[r.id,r]))), ids=[...new Set([...maps[1].keys(),...maps[2].keys()])].sort();
      merged[key]=ids.map(id=>{
        const [b,l,r]=maps.map(m=>m.get(id));
        if(!l||!r)return copy(l||r);
        if(key==='calendarOccurrences'){
          if(same(l,r))return copy({...r,updatedAt:Math.max(l.updatedAt||0,r.updatedAt||0)});
          if(b&&same(b,l))return copy(r);if(b&&same(b,r))return copy(l);
          let clash=!b;
          if(b){
            if(!!l.binding!==!!r.binding)clash=true;
            for(const k of ['binding','sourceBase','outcome'])if(!equal(l[k],b[k])&&!equal(r[k],b[k])&&!equal(l[k],r[k]))clash=true;
            const groups=[['dueDate','dueTime','endTime','allDay'],['text'],['location'],['notes'],['link'],['reminders'],['cancelled']];
            for(const g of groups)if(g.some(k=>!equal(l.value?.[k],b.value?.[k]))&&g.some(k=>!equal(r.value?.[k],b.value?.[k]))&&g.some(k=>!equal(l.value?.[k],r.value?.[k])))clash=true;
          }
          if(clash){conflicts.push({key,id,fields:['*'],local:copy(l),remote:copy(r)});return copy(l);}
          const result=mergeChanges(b,l,r);result.updatedAt=Math.max(l.updatedAt||0,r.updatedAt||0);return result;
        }
        const out=copy(r), conflict=[];
        if(same(l,r))return copy({...r,updatedAt:Math.max(l.updatedAt||0,r.updatedAt||0)});
        if(!b||((!!l.deletedAt!==!!r.deletedAt)&&!same(b,l)&&!same(b,r)))conflict.push('*');
        else if(same(b,l))return copy(r);
        else if(same(b,r))return copy(l);
        else {
          const groups=key==='schedule'?[['day','startTime','endTime','recurrence','date','termStart','termEnd','excludedDates','futureChanges']]:key==='academicYears'?[['startDate','endDate']]:key==='terms'?[['yearId','startDate','endDate','excludedDates']]:[];
          const grouped=new Set(groups.flat());
          [...new Set([...fields(l),...fields(r)])].filter(k=>!grouped.has(k)).forEach(k=>groups.push([k]));
          for(const group of groups){
            const lc=group.some(k=>!equal(l[k],b[k])),rc=group.some(k=>!equal(r[k],b[k]));
            if(lc&&rc&&group.some(k=>!equal(l[k],r[k])))conflict.push(...group);
            else if(lc)for(const k of group){if(l[k]===undefined)delete out[k];else out[k]=copy(l[k]);}
          }
        }
        out.updatedAt=Math.max(l.updatedAt||0,r.updatedAt||0);
        if(conflict.length)conflicts.push({key,id,fields:conflict,local:copy(l),remote:copy(r)});
        return out;
      });
    }
    const academic=typeof module==='object'&&module.exports?require('./learning-core'):globalThis.MufLearningCore;
    if(academic&&!academic.validateAcademic(merged).valid&&academic.validateAcademic(local||{}).valid&&academic.validateAcademic(remote||{}).valid){
      const keys=['academicYears','terms','subjects'],bundle=d=>Object.fromEntries(keys.map(k=>[k,copy(d?.[k]||[])]));
      for(let i=conflicts.length-1;i>=0;i--)if(keys.includes(conflicts[i].key))conflicts.splice(i,1);
      conflicts.push({key:'academicYears',id:'academic-structure',academicGroup:true,fields:['academicYears','terms','subjects'],local:{name:'الهيكل الدراسي',...bundle(local)},remote:{name:'الهيكل الدراسي',...bundle(remote)}});
      Object.assign(merged,bundle(local));
    }
    merged.updatedAt=Math.max(local?.updatedAt||0,remote?.updatedAt||0);
    return {merged,conflicts};
  }
  return {openAccountStorage,mergeChanges,reconcileLearning};
});
