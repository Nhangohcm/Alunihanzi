import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installFreeAccounts} from '../free-account-ui.js';
const {document}=parseHTML('<html><body><section id="host"></section></body></html>');
class Storage{m=new Map();getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
Object.assign(globalThis,{document,localStorage:new Storage(),sessionStorage:new Storage(),window:{ALUNI_SAVED_SYNC_CONFIG:{freeAccounts:true,apiBase:'https://test'}}});
let connected='',body,fail=true;
globalThis.fetch=async(url,opts)=>{body=JSON.parse(opts.body);if(fail){fail=false;throw Error('offline');}return {ok:true,json:async()=>({token:'acct_'+'a'.repeat(64),username:'alice',account_id:'-1',login_key:body.new_login_key,recovery_key:body.new_recovery_key})};};
const ui=installFreeAccounts(document.getElementById('host'),async course=>connected=course);ui.open();const form=document.querySelector('form');
Object.defineProperty(form.querySelector('[name="mode"]'),'value',{value:'register'});
form.querySelector('[name="username"]').value='alice';form.querySelector('[name="display_name"]').value='Alice';
await form.onsubmit({preventDefault(){}});const first=body;assert.equal(first.new_login_key.length,64);assert.equal(connected,'');
await form.onsubmit({preventDefault(){}});assert.equal(body.new_login_key,first.new_login_key,'network retry retains generated credentials');assert.equal(connected,'','must save codes before opening library');
await document.querySelector('[data-continue]').onclick();assert.equal(connected,'free:alice');assert.equal(ui.read().account_id,'-1');assert.equal(sessionStorage.m.size,0);assert.equal(document.querySelector('[data-login]').value,'');
assert.equal(ui.tokenFor({course:'free:other'}),null);
console.log('PASS free account UI: generated secrets, retry preservation, explicit save-code step, connect and account isolation.');
