const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,setDoc,getDoc,getDocs,updateDoc,deleteDoc}=require('firebase/firestore');
let env;
before(async()=>{
  // A demo project cannot fall through to production if an emulator is absent.
  assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^127\.0\.0\.1:8080$/);
  env=await initializeTestEnvironment({projectId:'demo-daily-tracker',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
});
after(async()=>{if(env)await env.cleanup();});
for(const name of ['days','meta','hifzSegments','readingItems','readingSessions']){
  test(`${name}: owner CRUD and queries; other accounts and anonymous denied`,async()=>{
    const own=env.authenticatedContext('owner').firestore();
    const path=`users/owner/${name}/entry`;
    await assertSucceeds(setDoc(doc(own,path),{value:1}));
    await assertSucceeds(getDoc(doc(own,path)));
    await assertSucceeds(getDocs(collection(own,`users/owner/${name}`)));
    await assertSucceeds(updateDoc(doc(own,path),{value:2}));
    for(const ctx of [env.authenticatedContext('stranger'),env.unauthenticatedContext()]){
      const db=ctx.firestore();
      await assertFails(getDoc(doc(db,path)));
      await assertFails(getDocs(collection(db,`users/owner/${name}`)));
      await assertFails(setDoc(doc(db,path),{value:3}));
      await assertFails(deleteDoc(doc(db,path)));
    }
    await assertSucceeds(deleteDoc(doc(own,path)));
  });
}
test('unknown, root and nested server-only paths denied even to owner',async()=>{
  const db=env.authenticatedContext('owner').firestore();
  for(const path of ['users/owner','users/owner/admin/entry','users/owner/days/entry/private/secret','admin/config']){
    await assertFails(setDoc(doc(db,path),{value:1}));
    await assertFails(getDoc(doc(db,path)));
  }
});
test('two independent SDK clients observe writes through Firestore',async()=>{
  const a=env.authenticatedContext('shared-user').firestore();
  const b=env.authenticatedContext('shared-user').firestore();
  const path='users/shared-user/days/2026-10-14';
  await setDoc(doc(a,path),{water:2,note:'from device A'});
  assert.equal((await getDoc(doc(b,path))).data().water,2);
  await updateDoc(doc(b,path),{water:3});
  assert.deepEqual((await getDoc(doc(a,path))).data(),{water:3,note:'from device A'});
});
