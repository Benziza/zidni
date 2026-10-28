const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(readFileSync(require('node:path').join(__dirname, '..', 'topics.js'), 'utf8'), context);
vm.runInContext(readFileSync(require('node:path').join(__dirname, '..', 'quick.js'), 'utf8'), context);
const page = (id) => ({ pageid: id, title: `Page ${id}`, extract: 'A summary. '.repeat(15) });

test('a batch supplies multiple discoveries without extra Wikipedia requests', async () => {
  let calls = 0;
  const next = context.createDiscoveryQueue(async () => { calls++; return [page(1), page(2), page(3)]; });
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await next('en', 'astronomy', null, [])).pageid);
  assert.deepEqual(ids, [1, 2, 3]);
  assert.equal(calls, 1);
  await next('en', 'astronomy', null, []);
  assert.equal(calls, 2);
});

test('changing topic or language discards cards from the previous selection', async () => {
  const calls = [];
  const next = context.createDiscoveryQueue(async (language, topic) => { calls.push(`${language}:${topic}`); return [page(calls.length), page(99)]; });
  assert.equal((await next('en', 'astronomy', null, [])).pageid, 1);
  assert.equal((await next('en', 'music', null, [])).pageid, 2);
  assert.equal((await next('ar', 'music', null, [])).pageid, 3);
  assert.deepEqual(calls, ['en:astronomy', 'en:music', 'ar:music']);
});

test('seen cards are discarded and short unseen summaries remain usable', async () => {
  let calls = 0;
  const next = context.createDiscoveryQueue(async () => ++calls === 1
    ? [page(1), { ...page(2), extract: 'Short.' }] : [page(3)]);
  assert.equal((await next('en', 'all', null, [{ lang: 'en', id: 1 }])).pageid, 2);
  assert.equal((await next('en', 'all', null, [])).pageid, 3);
  assert.equal(calls, 2);
});

test('an exhausted cached batch loads fresh cards instead of repeating history', async () => {
  let calls = 0;
  const next = context.createDiscoveryQueue(async () => ++calls === 1 ? [page(1), page(2)] : [page(2), page(3)]);
  assert.equal((await next('en', 'mathematics', null, [])).pageid, 1);
  assert.equal((await next('en', 'mathematics', null, [{ lang: 'en', id: 1 }, { lang: 'en', id: 2 }])).pageid, 3);
  assert.equal(calls, 2);
});

test('longer recent memory excludes cards beyond the detailed history and scopes IDs by language', async () => {
  const next = context.createDiscoveryQueue(async () => [page(1), page(2), page(3)]);
  assert.equal((await next('en', 'all', null, [], ['en:1', 'fr:2'])).pageid, 2);
  assert.equal((await next('en', 'all', null, [], ['en:1', 'en:2', 'fr:3'])).pageid, 3);
});

test('repeated or unavailable batches stop after bounded retries without recycling seen cards', async () => {
  let calls = 0;
  const next = context.createDiscoveryQueue(async () => { calls++; return [page(1)]; });
  await assert.rejects(next('en', 'all', null, [], ['en:1']), { name: 'TopicUnavailableError' });
  assert.equal(calls, 3);
  let attempts = 0;
  const branch = context.createDiscoveryQueue(async () => {
    if (++attempts === 1) { const error = new Error('Exhausted branch'); error.name = 'TopicUnavailableError'; throw error; }
    return [page(2)];
  });
  assert.equal((await branch('en', 'mathematics', null, [])).pageid, 2);
});

test('mixed-branch order is preserved even when one summary is short', async () => {
  const next = context.createDiscoveryQueue(async () => [{ ...page(1), extract: 'Short.' }, page(2), page(3)]);
  assert.equal((await next('en', 'mathematics', null, [])).pageid, 1);
  assert.equal((await next('en', 'mathematics', null, [])).pageid, 2);
});

test('failed loads can be retried without exposing cards from another topic', async () => {
  let failed = false;
  const next = context.createDiscoveryQueue(async (_language, topic) => {
    if (topic === 'music' && !failed) { failed = true; throw new Error('Offline'); }
    return [page(topic === 'music' ? 2 : 1), page(99)];
  });
  await next('en', 'astronomy', null, []);
  await assert.rejects(next('en', 'music', null, []), /Offline/);
  assert.equal((await next('en', 'music', null, [])).pageid, 2);
});

test('only a deliberate, mostly vertical upward swipe advances a card', () => {
  const start = { x: 100, y: 200, time: 0 };
  assert.equal(context.isUpwardSwipe(start, { x: 110, y: 100, time: 400 }), true);
  assert.equal(context.isUpwardSwipe(start, { x: 100, y: 150, time: 400 }), false);
  assert.equal(context.isUpwardSwipe(start, { x: 100, y: 300, time: 400 }), false);
  assert.equal(context.isUpwardSwipe(start, { x: 200, y: 100, time: 400 }), false);
  assert.equal(context.isUpwardSwipe(start, { x: 100, y: 100, time: 2000 }), false);
});

test('card excerpts preserve source wording, use the first paragraph and end on a word', () => {
  assert.equal(context.quickExcerpt('First paragraph.\nSecond paragraph.'), 'First paragraph.');
  assert.equal(context.quickExcerpt('A little curiosity goes a long way.', 25), 'A little curiosity goes…');
  assert.equal(context.quickExcerpt(''), '');
  assert.equal(context.quickExcerpt('مقتطف قصير من ويكيبيديا.'), 'مقتطف قصير من ويكيبيديا.');
});

test('card images must have valid dimensions and use a Wikimedia HTTPS host', () => {
  const image = { image: 'https://upload.wikimedia.org/photo.jpg', imageWidth: 400, imageHeight: 300 };
  assert.equal(context.hasArticleImage(image), true);
  assert.equal(context.hasArticleImage({ ...image, imageWidth: 0 }), false);
  assert.equal(context.hasArticleImage({ ...image, image: 'https://example.com/photo.jpg' }), false);
  assert.equal(context.hasArticleImage({ ...image, image: 'http://upload.wikimedia.org/photo.jpg' }), false);
});
