import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import * as core from '../account-sync/core.mjs';
const source=readFileSync(new URL('../saved-account-sync.js',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'');
class Storage{m=new Map();get length(){return this.m.size}key(i){return [...this.m.keys()][i]}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const storage=new Storage(),word={hanzi:'猫',pinyin:'māo',vi:'mèo'};storage.setItem(core.WORDS_KEY,JSON.stringify([word]));
const {document,Event}=parseHTML('<html><body><section id="writingSection"><section class="writing-quick-card"></section></section></body></html>');
const token=id=>Buffer.from(JSON.stringify({code_id:id})).toString('base64url')+'.signature';
let ents={'50plus':{token:token(1),course_id:'50plus'}},remote={ok:true,account_id:'1',revision:0,words:[],sentences:[]},requests=0;
const c={installFreeAccounts:()=>null,...core,document,Event,localStorage:storage,crypto:{randomUUID},atob,AbortController,setTimeout:()=>1,clearTimeout:()=>{},location:{reload(){}},navigator:{locks:{request:async(_,run)=>run()}},ALUNI_SAVED_SYNC_CONFIG:{enabled:true,apiBase:'https://staging.example'},savedEntitlements:()=>ents,saveEntitlement:()=>{},accessDeviceId:()=> 'device-a',renderSavedWritingVocabulary:()=>{},refreshWritingSaveButtons:()=>{},fetch:async(url,options)=>{requests++;assert.equal(url,'https://staging.example/student/saved-library');assert(options.headers.Authorization);if(options.method==='POST')remote={...remote,...JSON.parse(options.body),revision:remote.revision+1};return{ok:true,status:200,json:async()=>remote};},addEventListener:()=>{},dispatchEvent:()=>{}};c.window=c;
vm.createContext(c);vm.runInContext(source,c);
assert.equal(requests,0,'no cloud call before opt-in');assert.equal(JSON.parse(storage.getItem(core.WORDS_KEY))[0].hanzi,'猫');
// Linkedom select.value is getter-only: provide the browser-selected value.
const select=document.querySelector('select');Object.defineProperty(select,'value',{get:()=> '50plus'});
await document.querySelector('[data-connect]').onclick();assert.equal(JSON.parse(storage.getItem(core.WORDS_KEY)).length,0,'opening empty account does not silently upload guest words');assert(storage.getItem('aluni.sync.v1.guest'));
document.querySelector('[data-import]').onclick();assert.equal(JSON.parse(storage.getItem(core.WORDS_KEY))[0].hanzi,'猫');await document.querySelector('[data-sync]').onclick();assert.equal(remote.words[0].hanzi,'猫');
c.ALUNI_SAVED_SYNC.record('words',[word],[]);storage.setItem(core.WORDS_KEY,'[]');await document.querySelector('[data-sync]').onclick();assert.equal(remote.words.length,0);
document.querySelector('[data-disconnect]').onclick();assert.equal(JSON.parse(storage.getItem(core.WORDS_KEY))[0].hanzi,'猫','guest data restored');assert.equal(storage.getItem('aluni.sync.v1.active'),null);
await document.querySelector('[data-connect]').onclick();ents={'50plus':{token:token(2),course_id:'50plus'}};c.saveEntitlement();assert.equal(storage.getItem('aluni.sync.v1.active'),null,'different identity detaches');assert.equal(JSON.parse(storage.getItem(core.WORDS_KEY)).length,0,'old account not exposed to newly activated identity');
// Starting sync as a guest opens activation, then successful activation continues automatically.
ents={};let opened=0,closed=0;c.openAccess=()=>opened++;c.closeAccess=()=>closed++;
await document.querySelector('[data-connect]').onclick();assert.equal(opened,1);
ents={'50plus':{token:token(1),course_id:'50plus'}};
assert.equal(await c.ALUNI_SAVED_SYNC.afterActivation(ents['50plus']),true);
assert.equal(closed,1);assert.equal(JSON.parse(storage.getItem('aluni.sync.v1.active')).account,'1');
assert.equal(await c.ALUNI_SAVED_SYNC.afterActivation(ents['50plus']),false,'ordinary activation does not opt in');
const disabled={document:{},ALUNI_SAVED_SYNC_CONFIG:{enabled:false}};disabled.window=disabled;vm.createContext(disabled);vm.runInContext(source,disabled);assert.equal(disabled.ALUNI_SAVED_SYNC,undefined);
console.log('PASS: opt-in, no silent import, explicit guest migration, sync/delete, guest restoration, account switch isolation, feature disabled.');
