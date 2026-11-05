import {chapters,modules,regularQuestions,testQuestions,questionById,judge,defaultProgress,shopItems} from '../src/content.js';
import assert from 'node:assert/strict';
const all=[...regularQuestions,...testQuestions];
assert.equal(new Set(all.map(q=>q.id)).size,all.length,'Doppelte IDs');
assert.equal(regularQuestions.length,61,'Falsche Aufgabenzahl');
for(const q of all){
 assert.ok(modules.find(m=>m.id===q.module),`Unbekanntes Modul ${q.id}`);
 assert.ok([1,2,3].includes(q.afb),`Ungültiger AFB ${q.id}`);
 assert.ok(q.prompt?.length>15,`Ungültiger Aufgabentext ${q.id}`);
 assert.ok(q.why,`Lösungshinweis fehlt ${q.id}`);
 if(q.bonus)assert.ok(q.afb>=2,`Bonus AFB falsch ${q.id}`);
 if(q.type==='single')assert.ok(q.answer>=0&&q.answer<q.choices.length,`Single key ungültig ${q.id}`);
 if(q.type==='multi')assert.ok(q.answer.length>=2&&q.answer.every(i=>i<q.choices.length),`Multi key ungültig ${q.id}`);
 if(q.type==='classify')assert.equal(q.items.length,q.answer.length,`Zuordnung unvollständig ${q.id}`);
 if(q.type==='order')assert.equal(q.items.length,q.answer.length,`Reihenfolge unvollständig ${q.id}`);
 if(q.type!=='open')assert.ok(judge(q,q.answer),`Musterlösung wird nicht erkannt: ${q.id}`);
 if(q.type==='single'){const other=(q.answer+1)%q.choices.length;assert.equal(judge(q,other),false,`Falschantwort akzeptiert: ${q.id}`)}
 if(q.type==='truefalse')assert.equal(judge(q,!q.answer),false,`Falsche Wahrheitsantwort akzeptiert: ${q.id}`);
 if(q.type==='fill')assert.equal(judge(q,'garantiert falscher Fülltext xxyyzz'),false,`Ungültige Lücke akzeptiert: ${q.id}`);
 if(q.type==='multi')assert.equal(judge(q,[]),false,`Leere Mehrfachantwort akzeptiert: ${q.id}`);
 if(q.type==='classify'||q.type==='order')assert.equal(judge(q,[]),false,`Leere Zuordnung akzeptiert: ${q.id}`);
}
for(const m of modules){const qs=regularQuestions.filter(q=>q.module===m.id);for(const afb of [1,2,3])assert.ok(qs.some(q=>q.afb===afb),`AFB ${afb} fehlt in ${m.id}`)}
const counts=Object.fromEntries([1,2,3].map(a=>[a,regularQuestions.filter(q=>q.afb===a).length]));
assert.deepEqual(counts,{'1':15,'2':30,'3':16},'Verteilung der gekürzten Aufgabenbank');
console.log(`Kurs geprüft: ${chapters.length} Kapitel, ${modules.length} Unterkapitel, ${regularQuestions.length} Übungen, ${testQuestions.length} Testaufgaben.`);
console.log('AFB:',counts,'Anteile',Object.fromEntries([1,2,3].map(x=>[x,(100*counts[x]/regularQuestions.length).toFixed(1)+'%'])));
console.log('Aufgabentypen:',[...new Set(all.map(q=>q.type))].join(', '));
console.log('Quellaufgaben mit Kennzeichnung:',regularQuestions.filter(q=>q.source).length);
assert.equal(defaultProgress().spent,0);
assert.ok(shopItems.length>5);
