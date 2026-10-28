const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const article = (id, lang = 'en') => ({ id, lang, title: `Article ${id}`, extract: 'Summary', url: `https://${lang}.wikipedia.org/?curid=${id}` });
function harness(stored) {
  let persisted;
  let requestedRecent;
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { addEventListener() {}, dataset: {} });
    return elements.get(id);
  };
  const context = vm.createContext({
    URLSearchParams, AbortController, setTimeout, clearTimeout,
    LANGUAGES: { en: 'English', fr: 'French', ar: 'Arabic', ary: 'Darija' },
    $: element,
    localStorage: { getItem: () => JSON.stringify(stored), setItem: (_key, value) => { persisted = JSON.parse(value); } },
    document: { addEventListener() {}, querySelector: element },
    createDiscoveryQueue: () => async (_language, _topic, _signal, _history, recent) => {
      requestedRecent = Array.from(recent);
      return { pageid: 1001, title: 'New article', extract: 'Summary' };
    },
    setQuickBusy() {}, closeLanguageMenu() {}, applyLanguage() {}, initQuickDiscovery() {}, t: (key) => key
  });
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'topics.js'), 'utf8'), context);
  vm.runInContext(readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), context);
  vm.runInContext('showArticle = () => {};', context);
  return { context, recent: () => Array.from(vm.runInContext('state.recent', context)),
    persisted: () => persisted, requestedRecent: () => requestedRecent };
}

test('existing detailed history migrates into compact recent memory', () => {
  const app = harness({ history: [article(2), article(1, 'fr')] });
  assert.deepEqual(app.recent(), ['en:2', 'fr:1']);
});

test('restoring recent memory filters malformed keys and keeps valid older history', () => {
  const app = harness({ recent: ['en:2', null, 'xx:3', 'en:-4', 'fr:5', 'en:2'], history: [article(6)] });
  assert.deepEqual(app.recent(), ['en:2', 'fr:5', 'en:6']);
});

test('discoveries persist the last 1000 IDs separately from the last 60 full articles', async () => {
  const recent = Array.from({ length: 1000 }, (_, i) => `en:${1000 - i}`);
  const app = harness({ recent, history: Array.from({ length: 60 }, (_, i) => article(1000 - i)) });
  await app.context.discover();
  const stored = app.persisted();
  assert.deepEqual(app.requestedRecent(), recent);
  assert.equal(stored.recent.length, 1000);
  assert.equal(stored.recent[0], 'en:1001');
  assert.equal(stored.recent.at(-1), 'en:2');
  assert.equal(stored.history.length, 60);
  assert.equal(stored.history[0].id, 1001);
  assert.deepEqual(harness(stored).recent(), stored.recent);
});

test('malformed browser storage starts with empty memory', () => {
  assert.deepEqual(harness(null).recent(), []);
  assert.deepEqual(harness({ recent: {} }).recent(), []);
});
