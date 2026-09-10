const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'access-config.js'), 'utf8');

function boot(hostname, search) {
  const ready = [];
  const loaded = [];
  const document = {
    readyState: 'loading',
    getElementById() { return null; },
    addEventListener(type, fn) { if (type === 'DOMContentLoaded') ready.push(fn); },
    createElement() { return {}; },
    head: {appendChild(node) { loaded.push(node); }},
  };
  const context = {document, location: {hostname, search}, URLSearchParams};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  ready.forEach(fn => fn());
  return {context, loaded};
}

let result = boot('tiengtrungaluni.com', '?saved_sync=1&free_accounts=1');
assert.equal(result.context.ALUNI_API_BASE, 'https://aluni-tts.nhangohcm.workers.dev');
assert.deepEqual(JSON.parse(JSON.stringify(result.context.ALUNI_SAVED_SYNC_CONFIG)), {
  enabled: true,
  freeAccounts: true,
  apiBase: 'https://aluni-tts.nhangohcm.workers.dev',
});
assert.equal(result.loaded.length, 1);
assert.equal(result.loaded[0].src, 'saved-account-sync.js?v=1');

result = boot('aluni-v47-test.pages.dev', '?saved_sync=1&free_accounts=1');
assert.equal(result.context.ALUNI_API_BASE, 'https://aluni-tts-staging.nhangohcm.workers.dev');
assert.equal(result.context.ALUNI_SAVED_SYNC_CONFIG.enabled, true);

result = boot('tiengtrungaluni.com', '');
assert.equal(result.context.ALUNI_SAVED_SYNC_CONFIG, undefined);
assert.equal(result.loaded.length, 0);

result = boot('example.com', '?saved_sync=1&free_accounts=1');
assert.equal(result.context.ALUNI_SAVED_SYNC_CONFIG, undefined);
assert.equal(result.loaded.length, 0);

console.log('PASS: private production sync preview uses production Worker; ordinary visitors and unrelated hosts remain disabled.');
