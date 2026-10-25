const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const source = readFileSync(require('node:path').join(__dirname, '..', 'topics.js'), 'utf8');
function harness(reply, history = []) {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams,
    state: { history },
    Math: Object.assign(Object.create(Math), { random: () => 0.9 }),
    fetch: async (url, options) => {
      const parsed = new URL(url);
      calls.push({ language: parsed.hostname.split('.')[0], params: parsed.searchParams, options });
      return { ok: true, json: async () => reply(calls.at(-1)) };
    }
  });
  vm.runInContext(source, context);
  return { context, calls, discover: (language, topic, signal) => context.discoverPages(language, topic, signal) };
}
const article = (pageid, extra = {}) => ({ pageid, ns: 0, title: `Article ${pageid}`, extract: 'A useful summary.', ...extra });

test('all topics preserves the original random generator and filters unsuitable pages', async () => {
  const { discover, calls } = harness(() => ({ query: { pages: [article(1), article(2, { pageprops: { disambiguation: '' } }), article(3, { redirect: true }), article(4, { missing: true }), article(5, { ns: 14 })] } }));
  const pages = await discover('ary', 'all');
  assert.deepEqual(Array.from(pages, (page) => page.pageid), [1]);
  assert.equal(calls[0].language, 'ary');
  assert.equal(calls[0].params.get('generator'), 'random');
});

test('localized topics use the category language link and preserve the abort signal', async () => {
  const signal = new AbortController().signal;
  const { discover, calls } = harness(({ params }) => {
    if (params.get('prop') === 'langlinks') return { query: { pages: [{ langlinks: [{ title: 'Catégorie:Astronomie' }] }] } };
    if (params.get('list')) return { query: { categorymembers: [{ pageid: 42, ns: 0 }] } };
    return { query: { pages: [article(42)] } };
  });
  assert.equal((await discover('fr', 'astronomy', signal))[0].pageid, 42);
  assert.equal(calls[0].language, 'en');
  assert.equal(calls[0].params.get('lllang'), 'fr');
  assert.equal(calls[1].language, 'fr');
  assert.equal(calls[1].params.get('cmtitle'), 'Catégorie:Astronomie');
  assert.ok(calls.every((call) => call.options.signal === signal));
  assert.ok(calls.every((call) => !call.params.has('generator')));
});

test('walks into subcategories and prioritizes unseen article IDs', async () => {
  const { discover, calls } = harness(({ params }) => {
    if (params.get('list')) return { query: { categorymembers: params.get('cmtitle') === 'Category:Astronomy'
      ? [{ ns: 14, title: 'Category:Planets' }]
      : [{ ns: 0, pageid: 1 }, { ns: 0, pageid: 2 }] } };
    return { query: { pages: [article(1), article(2)] } };
  }, [{ lang: 'en', id: 1 }]);
  await discover('en', 'astronomy');
  assert.equal(calls[1].params.get('cmtitle'), 'Category:Planets');
  assert.equal(calls[2].params.get('pageids'), '2|1');
});

test('unavailable language categories never fall back to unrelated random articles', async () => {
  const { discover, calls } = harness(() => ({ query: { pages: [{}] } }));
  await assert.rejects(discover('ary', 'astronomy'), { name: 'TopicUnavailableError' });
  assert.equal(calls.length, 1);
});

test('large categories request at most five extracts and stop after the first useful batch', async () => {
  const { discover, calls } = harness(({ params }) => {
    if (params.get('list')) return { query: { categorymembers: Array.from({ length: 100 }, (_, index) => ({ ns: 0, pageid: index + 1 })) } };
    return { query: { pages: params.get('pageids').split('|').map((id) => article(Number(id))) } };
  });
  assert.equal((await discover('en', 'astronomy')).length, 5);
  const batches = calls.filter((call) => call.params.has('pageids'));
  assert.equal(batches.length, 1);
  assert.equal(batches[0].params.get('pageids').split('|').length, 5);
  assert.equal(batches[0].params.get('exlimit'), '5');
});

test('an unusable batch retries different articles from the same category only', async () => {
  let batch = 0;
  const { discover, calls } = harness(({ params }) => {
    if (params.get('list')) return { query: { categorymembers: Array.from({ length: 12 }, (_, index) => ({ ns: 0, pageid: index + 1 })) } };
    batch++;
    return { query: { pages: params.get('pageids').split('|').map((id) => article(Number(id), batch === 1 ? { pageprops: { disambiguation: '' } } : {})) } };
  });
  assert.equal((await discover('en', 'astronomy')).length, 5);
  const batches = calls.filter((call) => call.params.has('pageids'));
  assert.equal(batches.length, 2);
  const firstIds = batches[0].params.get('pageids').split('|');
  assert.ok(batches[1].params.get('pageids').split('|').every((id) => !firstIds.includes(id)));
  assert.ok(calls.every((call) => !call.params.has('generator')));
});

test('empty and cyclic category branches terminate with a topic-specific error', async () => {
  const { discover, calls } = harness(() => ({ query: { categorymembers: [{ ns: 14, title: 'Category:Astronomy' }] } }));
  await assert.rejects(discover('en', 'astronomy'), { name: 'TopicUnavailableError' });
  assert.equal(calls.length, 1);
});

test('backtracks from an empty subcategory to articles in its parent', async () => {
  const { discover } = harness(({ params }) => {
    if (params.get('list')) return { query: { categorymembers: params.get('cmtitle') === 'Category:Astronomy'
      ? [{ ns: 0, pageid: 9 }, { ns: 14, title: 'Category:Empty' }] : [] } };
    return { query: { pages: [article(9)] } };
  });
  assert.equal((await discover('en', 'astronomy'))[0].pageid, 9);
});

test('API errors and aborts propagate instead of being treated as an empty topic', async () => {
  const api = harness(() => ({ error: { info: 'API unavailable' } }));
  await assert.rejects(api.discover('en', 'astronomy'), /API unavailable/);
  const aborted = harness(() => { const error = new Error('Aborted'); error.name = 'AbortError'; throw error; });
  await assert.rejects(aborted.discover('en', 'all'), { name: 'AbortError' });
});

test('offers 20 unique topics with labels for all four languages', () => {
  const { context } = harness(() => ({}));
  assert.equal(vm.runInContext('TOPICS.length', context), 20);
  assert.equal(vm.runInContext('new Set(TOPICS.map(topic => topic.id)).size', context), 20);
  assert.ok(vm.runInContext("TOPICS.every(topic => ['en','fr','ar','ary'].every(lang => topic.labels[lang]))", context));
});
