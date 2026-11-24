import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {getFirestore, collection, doc, setDoc, onSnapshot, serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
// Configuration inserted at build time. Firebase web configuration is not a credential.
const config = {"apiKey": "AIzaSyDAxCJ0ZdfwWz48DH4q2QJykFjCBDPAbhE", "authDomain": "habit-tracker-f6a50.firebaseapp.com", "projectId": "habit-tracker-f6a50", "storageBucket": "habit-tracker-f6a50.firebasestorage.app", "messagingSenderId": "207965835780", "appId": "1:207965835780:web:0c3ff3de4eb51805481b51"};
const auth = getAuth(initializeApp(config));
const db = getFirestore();
const listeners = new Set();
const state = {user:null, records:{}, notes:{}, goals:{}, diagnostics:{}, ready:false, pending:0, error:null};
let pendingRequests=0;
const pendingSnapshots=new Set();
let stops=[];
function emit(){listeners.forEach(fn=>fn({...state}));}
function clear(){stops.forEach(stop=>stop()); stops=[]; state.records={};state.notes={};state.goals={};state.diagnostics={};state.ready=false;pendingSnapshots.clear();state.pending=pendingRequests;}
onAuthStateChanged(auth,user=>{
 clear();state.user=user;state.error=null;emit();if(!user)return;
 let loaded=new Set();
 for(const name of ['records','notes','goals','diagnostics']){
  stops.push(onSnapshot(collection(db,'users',user.uid,name),{includeMetadataChanges:true},snapshot=>{
   state[name]=Object.fromEntries(snapshot.docs.map(d=>[d.id,d.data()]));
   if(!snapshot.metadata.fromCache)loaded.add(name);state.ready=loaded.size===4;
   if(snapshot.metadata.hasPendingWrites)pendingSnapshots.add(name);else pendingSnapshots.delete(name);
   state.pending=pendingRequests+pendingSnapshots.size;
   state.error=null;emit();
  },error=>{state.error='Private sync unavailable. Nothing has been marked complete. '+error.code;state.ready=false;emit();}));
 }
});
window.HabitCloud={
 subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},
 async login(email,password){await signInWithEmailAndPassword(auth,email,password);},
 logout(){return signOut(auth);},
 async save(type,id,value){
  if(!state.user||!state.ready)throw new Error('Sign in and wait for private sync before making changes.');
  pendingRequests++;state.pending=pendingRequests+pendingSnapshots.size;emit();
  try{await setDoc(doc(db,'users',state.user.uid,type,id),{...value,updatedAt:serverTimestamp()});}
  catch(error){state.error='Not saved. Please try again. '+error.code;throw error;}
  finally{pendingRequests=Math.max(0,pendingRequests-1);state.pending=pendingRequests+pendingSnapshots.size;emit();}
 }
};
window.dispatchEvent(new Event('habit-cloud-ready'));
