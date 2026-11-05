import { getStore } from '@netlify/blobs';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { questionById, judge, defaultProgress, xpFor, shopItems } from '../../src/content.js';

const SESSION_AGE = 30 * 24 * 3600 * 1000;
const MIN_PASSWORD = 8;
const SHA = x => createHash('sha256').update(String(x)).digest('hex');
const norm = x => String(x || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
const validClass = x => /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,39}$/u.test(String(x || '').trim());
const validNick = x => /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u.test(String(x || '').trim());
const userKey = (klass, nick) => `${SHA(norm(klass)).slice(0,28)}/${SHA(norm(nick)).slice(0,28)}`;
const classKey = klass => SHA(norm(klass)).slice(0,28);
const hashPassword = password => { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; };
const verifyPassword = (password, stored) => { try { const [salt,hex]=stored.split(':'); const target=Buffer.from(hex,'hex'); const given=scryptSync(password,salt,target.length); return given.length===target.length && timingSafeEqual(given,target); } catch { return false; } };
const users = () => getStore('rechtsklar-users');
const classes = () => getStore('rechtsklar-classes');
const sessions = () => getStore('rechtsklar-sessions');
const limits = () => getStore('rechtsklar-attempts');
const read = async(store,key) => store.get(key,{type:'json',consistency:'strong'});
const noCache = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const json = (data,status=200,headers={}) => new Response(JSON.stringify(data),{status,headers:{...noCache,...headers}});
const err = (message,status=400) => json({error:message},status);
const publicUser = u => ({nick:u.nick,klass:u.klass,role:u.role,mustChangePassword:!!u.mustChangePassword});
const clientState = u => ({user:publicUser(u),progress:u.progress||defaultProgress()});
const cookie = (token,maxAge) => `rc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const tokenHash = token => SHA(token);

async function getAuth(request) {
 const str=request.headers.get('cookie')||'';
 const token=(str.match(/(?:^|;\s*)rc_session=([a-f0-9]{64})(?:;|$)/)||[])[1];
 if(!token)return null;
 const ses=await read(sessions(),tokenHash(token));
 if(!ses||ses.expires<Date.now())return null;
 const u=await read(users(),ses.userKey);
 return u && (!ses.sessionEpoch || ses.sessionEpoch===u.sessionEpoch)?{u,key:ses.userKey,token}:null;
}
async function createSession(key,u){
 const token=randomBytes(32).toString('hex');
 await sessions().setJSON(tokenHash(token),{userKey:key,expires:Date.now()+SESSION_AGE,sessionEpoch:u?.sessionEpoch});
 return cookie(token,Math.round(SESSION_AGE/1000));
}
async function updateUser(key,transform){
 const store=users();
 for(let attempt=0; attempt<7; attempt++){
  const entry=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  if(!entry)return null;
  const old=entry.data;
  const next=await transform(old);
  if(next===false)return {unchanged:true,user:old};
  const {modified}=await store.setJSON(key,next,{onlyIfMatch:entry.etag});
  if(modified)return {user:next};
 }
 throw new Error('Konkurrierende Änderungen. Bitte erneut versuchen.');
}
function validateLogin(body){
 const klass=String(body.klass||'').trim(),nick=String(body.nick||'').trim();
 if(!validClass(klass)||!validNick(nick))throw new Error('Klasse (2–40 Zeichen) und Nickname (2–24 Zeichen) dürfen Buchstaben, Zahlen, Leerzeichen, Punkt, _ und - enthalten.');
 if(typeof body.password!=='string'||body.password.length<MIN_PASSWORD||body.password.length>128)throw new Error('Das Passwort muss zwischen 8 und 128 Zeichen enthalten.');
 return {klass,nick,password:body.password};
}
async function checkAttempts(req,key){
 const ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const id=SHA(ip+'|'+key);
 const st=limits();const v=await read(st,id);
 if(v&&v.until>Date.now()&&v.count>=8)return false;
 return true;
}
async function recordAttempt(req,key,success=false){
 const ip=req.headers.get('x-nf-client-connection-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 const id=SHA(ip+'|'+key),st=limits();
 const v=await read(st,id);
 if(success){await st.delete(id);return;}
 await st.setJSON(id,{count:(v&&v.until>Date.now()?v.count:0)+1,until:Date.now()+15*60*1000});
}
async function classUsers(klass){
 const st=users(),prefix=`${classKey(klass)}/`;const results=[];let cursor;
 do{const page=await st.list({prefix, ...(cursor?{cursor}:{})});
  const batch=await Promise.all(page.blobs.map(async item=>({key:item.key,u:await read(st,item.key)})));
  for(const entry of batch)if(entry.u&&norm(entry.u.klass)===norm(klass))results.push(entry);
  cursor=page.hasMore?page.cursor:null;
 }while(cursor);
 return results;
}
function completion(u){const values=Object.values(u.progress?.answers||{});const done=values.filter(v=>v.correct).length;return {done,earned:u.progress?.earned||0,balance:Math.max(0,(u.progress?.earned||0)-(u.progress?.spent||0)),last:values.reduce((n,v)=>Math.max(n,v.date||0),0)};}
export default async function handler(req){
 const origin=new URL(req.url).origin;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Allow':'GET,POST,OPTIONS','Cache-Control':'no-store'}});
 const pathname=new URL(req.url).pathname;
 const action=pathname.split('/').filter(Boolean).pop()||'not-found';
 const isPost=req.method==='POST';
 if(!['GET','POST'].includes(req.method))return err('Methode nicht erlaubt.',405);
 if(isPost){
  const originHeader=req.headers.get('origin');
  if(originHeader && originHeader!==origin)return err('Anfrageursprung nicht zugelassen.',403);
  if(Number(req.headers.get('content-length')||0)>250000)return err('Anfrage zu groß.',413);
 }
 let b={};
 try{ if(isPost)b=await req.json(); }
 catch{return err('Ungültige JSON-Anfrage.');}
 try{
  if(action==='register'&&isPost){
   const {klass,nick,password}=validateLogin(b),role=b.role==='teacher'?'teacher':'student';
   if(role==='teacher'){
    const code=process.env.LEHRER_SETUP_CODE;
    if(!code||code.length<12)return err('LEHRER_SETUP_CODE ist auf Netlify nicht gesetzt (mindestens 12 Zeichen).',503);
    const supplied=Buffer.from(SHA(String(b.teacherCode||'')),'hex'),expected=Buffer.from(SHA(code),'hex');
    if(!timingSafeEqual(supplied,expected))return err('Lehrkraft-Code ist ungültig.',403);
   } else {
    const group=await read(classes(),classKey(klass));
    if(!group)return err('Diese Klasse existiert noch nicht. Bitte erst den Lehrkraftzugang für die Klasse anlegen.');
   }
   const key=userKey(klass,nick);
   const u={nick,klass,role,passwordHash:hashPassword(password),sessionEpoch:randomBytes(16).toString('hex'),created:Date.now(),progress:defaultProgress(),mustChangePassword:false};
   const result=await users().setJSON(key,u,{onlyIfNew:true});
   if(!result.modified)return err('Dieser Nickname existiert bereits in dieser Klasse.',409);
   if(role==='teacher')await classes().setJSON(classKey(klass),{klass,created:Date.now()});
   const session=await createSession(key,u);
   return json(clientState(u),201,{'Set-Cookie':session});
  }
  if(action==='login'&&isPost){
   const {klass,nick,password}=validateLogin(b); const key=userKey(klass,nick);
   if(!(await checkAttempts(req,key)))return err('Zu viele Anmeldeversuche. Bitte später erneut versuchen.',429);
   const u=await read(users(),key);
   if(!u||!verifyPassword(password,u.passwordHash)){
    await recordAttempt(req,key);
    return err('Klasse, Nickname oder Passwort ist nicht korrekt.',401);
   }
   await recordAttempt(req,key,true);
   const session=await createSession(key,u);
   return json(clientState(u),200,{'Set-Cookie':session});
  }
  if(action==='logout'&&isPost){
   const auth=await getAuth(req);
   if(auth)await sessions().delete(tokenHash(auth.token));
   return json({ok:true},200,{'Set-Cookie':cookie('',0)});
  }
  const auth=await getAuth(req);
  if(action==='session'&&req.method==='GET')return auth?json(clientState(auth.u)):err('Nicht angemeldet.',401);
  if(!auth)return err('Bitte melden Sie sich an.',401);
  if(action==='progress'&&req.method==='GET')return json(clientState(auth.u));
  if(action==='submit'&&isPost){
   const q=questionById[String(b.id||'')];
   if(!q)return err('Aufgabe nicht gefunden.',404);
   if(typeof b.answer==='object' && JSON.stringify(b.answer).length>12000)return err('Antwort zu umfangreich.');
   if(typeof b.answer==='string' && b.answer.length>8000)return err('Antwort zu umfangreich.');
   if(q.type==='open'&&b.approved&&!auth.u.progress?.answers?.[q.id]?.solutionSeen)return err('Vergleichen Sie Ihre Antwort zuerst mit der Musterlösung.');
   const correct=judge(q,b.answer,b.approved);
   const update=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress(),previous=p.answers[q.id];
    const awarded=correct && !previous?.correct ? xpFor(q):0;
    const tries=(previous?.tries||0)+1;
    p.answers[q.id]={answer:b.answer,reason:typeof b.reason==='string'?b.reason.slice(0,2500):'',correct:!!(previous?.correct||correct),latestCorrect:correct,tries,awarded:(previous?.awarded||0)+awarded,date:Date.now(),solutionSeen:previous?.solutionSeen||false};
    p.earned=(p.earned||0)+awarded;
    p.events=[...(p.events||[]).slice(-29),{type:correct?'correct':'attempt',id:q.id,date:Date.now()}];
    return {...u,progress:p};
   });
   return json({...clientState(update.user),correct,earnedNow:correct ? (!auth.u.progress?.answers?.[q.id]?.correct?xpFor(q):0):0});
  }
  if(action==='solution'&&isPost){
   const q=questionById[String(b.id||'')];if(!q)return err('Aufgabe nicht gefunden.',404);
   const update=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress();
    p.answers[q.id]={...(p.answers[q.id]||{}),solutionSeen:true,date:p.answers[q.id]?.date||Date.now()};
    return {...u,progress:p};
   });
   return json(clientState(update.user));
  }
  if(action==='buy'&&isPost){
   const item=shopItems.find(x=>x.id===b.id);if(!item)return err('Artikel nicht gefunden.');
   let status='ok';
   const updated=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress();
    if(p.owned.includes(item.id)){status='owned';return false;}
    if(p.earned-p.spent<item.cost){status='funds';return false;}
    p.owned.push(item.id);p.spent+=item.cost;return {...u,progress:p};
   });
   return status==='funds'?err('Dafür reichen Ihre verfügbaren XP noch nicht.'):json(clientState(updated.user));
  }
  if(action==='equip'&&isPost){
   const item=shopItems.find(x=>x.id===b.id);if(!item)return err('Artikel nicht gefunden.');
   let allowed=true;
   const updated=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress();
    if(!p.owned.includes(item.id)){allowed=false;return false;}
    p.equipped[item.type]=item.id;return {...u,progress:p};
   });
   return allowed?json(clientState(updated.user)):err('Bitte schalten Sie den Artikel zunächst frei.');
  }
  if(action==='checklist'&&isPost){
   const idx=Number(b.index),rating=Number(b.rating),done=!!b.done;
   if(!Number.isInteger(idx)||idx<0||idx>8||!Number.isInteger(rating)||rating<1||rating>5)return err('Ungültiger Checklistenwert.');
   const updated=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress();p.checklist[idx]={rating,done};return {...u,progress:p};
   });
   return json(clientState(updated.user));
  }
  if(action==='import'&&isPost){
   const entries=Object.entries(b.answers||{}).slice(0,250);
   const update=await updateUser(auth.key,u=>{
    const p=u.progress||defaultProgress();
    for(const [id,item] of entries){
     const q=questionById[id];if(!q||!item||typeof item!=='object')continue;
     if(p.answers[id]?.correct)continue;
     if(typeof item.answer==='string'&&item.answer.length>8000)continue;
     const correct=judge(q,item.answer,q.type==='open'&&item.correct&&item.selfReviewed&&item.solutionSeen);
     const aw=correct?xpFor(q):0;
     p.answers[id]={answer:item.answer,reason:String(item.reason||'').slice(0,2500),correct,latestCorrect:correct,tries:1,awarded:aw,date:Date.now(),solutionSeen:!!item.solutionSeen,selfReviewed:!!item.selfReviewed};p.earned+=aw;
    }
    // Gastkäufe nur übernehmen, wenn die serverseitig neu berechneten XP ausreichen.
    for(const id of Array.isArray(b.owned)?b.owned.slice(0,shopItems.length):[]){
     const item=shopItems.find(x=>x.id===id);
     if(item&&!p.owned.includes(id) && p.earned-p.spent>=item.cost){p.owned.push(id);p.spent+=item.cost;}
    }
    if(b.equipped&&typeof b.equipped==='object')for(const type of ['outfit','pet','back']){
     const id=b.equipped[type],item=shopItems.find(x=>x.id===id&&x.type===type);
     if(item&&p.owned.includes(id))p.equipped[type]=id;
    }
    if(b.checklist&&typeof b.checklist==='object')for(let idx=0;idx<9;idx++){
     const v=b.checklist[idx];if(!v||typeof v!=='object')continue;
     if(Number.isInteger(v.rating)&&v.rating>=1&&v.rating<=5)p.checklist[idx]={rating:v.rating,done:!!v.done};
    }
    return {...u,progress:p};
   });
   return json(clientState(update.user));
  }
  if(action==='change-password'&&isPost){
   if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)return err('Das neue Passwort muss 8–128 Zeichen enthalten.');
   if(!verifyPassword(String(b.current||''),auth.u.passwordHash))return err('Das bisherige Passwort ist nicht korrekt.',403);
   const updated=await updateUser(auth.key,u=>({...u,passwordHash:hashPassword(b.password),sessionEpoch:randomBytes(16).toString('hex'),mustChangePassword:false}));
   await sessions().setJSON(tokenHash(auth.token),{userKey:auth.key,expires:Date.now()+SESSION_AGE,sessionEpoch:updated.user.sessionEpoch});
   return json(clientState(updated.user));
  }
  if(action==='leaderboard'&&req.method==='GET'){
   const entries=await classUsers(auth.u.klass);
   return json({users:entries.filter(x=>x.u.role==='student').map(x=>({nick:x.u.nick,...completion(x.u)})).sort((a,b)=>b.earned-a.earned).slice(0,25)});
  }
  if(auth.u.role!=='teacher')return err('Nur für Lehrkräfte.',403);
  if(action==='students'&&req.method==='GET'){
   const entries=await classUsers(auth.u.klass);
   return json({users:entries.filter(x=>x.u.role==='student').map(({u})=>({nick:u.nick,klass:u.klass,created:u.created,...completion(u),answered:u.progress?.answers||{},checklist:u.progress?.checklist||{}})).sort((a,b)=>b.earned-a.earned)});
  }
  if(action==='reset-password'&&isPost){
   const target=userKey(auth.u.klass,b.nick);const student=await read(users(),target);
   if(!student||student.role!=='student'||norm(student.klass)!==norm(auth.u.klass))return err('Nutzer nicht gefunden.',404);
   const temporary=randomBytes(12).toString('base64url');
   await updateUser(target,u=>({...u,passwordHash:hashPassword(temporary),sessionEpoch:randomBytes(16).toString('hex'),mustChangePassword:true}));
   return json({ok:true,temporary});
  }
  if(action==='delete-user'&&isPost){
   const target=userKey(auth.u.klass,b.nick);const student=await read(users(),target);
   if(!student||student.role!=='student'||norm(student.klass)!==norm(auth.u.klass))return err('Nutzer nicht gefunden.',404);
   await users().delete(target);
   return json({ok:true});
  }
  if(action==='reset-progress'&&isPost){
   if(b.all===true){
    if(b.confirm!==`ALLE ${auth.u.klass}`)return err(`Bitte „ALLE ${auth.u.klass}“ bestätigen.`);
    const students=(await classUsers(auth.u.klass)).filter(x=>x.u.role==='student');
    for(let i=0;i<students.length;i+=8){
     await Promise.all(students.slice(i,i+8).map(entry=>updateUser(entry.key,u=>({...u,progress:defaultProgress()}))));
    }
    return json({ok:true,count:students.length});
   }
   const target=userKey(auth.u.klass,b.nick);const student=await read(users(),target);
   if(!student||student.role!=='student'||norm(student.klass)!==norm(auth.u.klass))return err('Nutzer nicht gefunden.',404);
   await updateUser(target,u=>({...u,progress:defaultProgress()}));
   return json({ok:true,count:1});
  }
  return err('Unbekannte Funktion.',404);
 }catch(e){
  console.error('Rechtsklar API',action,e?.message);
  return err(e?.message||'Technischer Fehler.',500);
 }
}
export const config={path:'/api/:action'};
