import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {modules,regularQuestions,testQuestions,chapters,glossary,shopItems,competencies,sources,questionById,xpFor,judge,defaultProgress} from '../src/content.js';

// Dependency-free UI smoke test. Render the browser app with a fake DOM to catch
// accidental regressions from stacked tasks back to one-by-one navigation.
const html={innerHTML:'',listeners:{},addEventListener(name,handler){this.listeners[name]=handler;}};
const store=new Map();
const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const sandbox={
 console,Date,Math,Intl,Number,String,Boolean,Array,Object,Set,Map,JSON,structuredClone,
 setTimeout:()=>0,clearTimeout:()=>{},
 document:{getElementById:id=>id==='app'?html:null,querySelector:()=>null},
 window:{scrollTo:()=>{},scrollBy:()=>{}},
 localStorage:storage,
 navigator:{clipboard:{writeText:async()=>{}}},
 fetch:async()=>{throw Error('No server in unit smoke test')},
 jsPDF:class{},createIcons:()=>{},icons:{},chapters,modules,glossary,shopItems,competencies,sources,regularQuestions,testQuestions,questionById,xpFor,judge,defaultProgress
};
vm.createContext(sandbox);
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .*?;\r?\n/gm,'');
vm.runInContext(source,sandbox,{filename:'src/main.js'});

function taskCount(){return (html.innerHTML.match(/data-task-id="/g)||[]).length;}
for(const m of modules){
 vm.runInContext(`route('module','${m.id}')`,sandbox);
 const expected=regularQuestions.filter(x=>x.module===m.id).length;
 assert.equal(taskCount(),expected,`${m.id}: questions must all be stacked`);
 assert.ok(html.innerHTML.includes('class="tasks-stack"'),`No stack for ${m.id}`);
 assert.ok(!html.innerHTML.includes('class="task-pills"'),`Old pager found ${m.id}`);
 assert.ok(!html.innerHTML.includes('Vorherige Aufgabe'),`Old navigation found ${m.id}`);
 for(const q of regularQuestions.filter(x=>x.module===m.id))assert.ok(html.innerHTML.includes(`id="task-${q.id}"`),`Missing rendered task ${q.id}`);
}
vm.runInContext("route('test')",sandbox);
assert.equal(taskCount(),testQuestions.length,'Test questions must also be stacked');
assert.ok(!html.innerHTML.includes('Vorherige Aufgabe'),'Test pager was not removed');
// The first choice must not be accidentally preselected when the user has not answered.
vm.runInContext("route('module','w1')",sandbox);
assert.ok(!html.innerHTML.includes('name="q-w1-02" data-input="w1-02" value="0" checked'), 'Default single-answer selection bug');
console.log(`UI geprüft: ${modules.length} Unterkapitel, alle ${regularQuestions.length} Übungen und ${testQuestions.length} Testfragen werden ohne Aufgaben-Pager untereinander dargestellt.`);
