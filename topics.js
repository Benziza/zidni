'use strict';

// English category roots are resolved to their Wikipedia language links at runtime.
const TOPICS = [
  ['astronomy', 'Astronomy', 'Astronomie', 'علم الفلك', 'الفلك'],
  ['physics', 'Physics', 'Physique', 'الفيزياء', 'الفيزياء'],
  ['chemistry', 'Chemistry', 'Chimie', 'الكيمياء', 'الكيميا'],
  ['biology', 'Biology', 'Biologie', 'علم الأحياء', 'علم الحياة'],
  ['mathematics', 'Mathematics', 'Mathématiques', 'الرياضيات', 'الرياضيات'],
  ['earth', 'Earth sciences', 'Sciences de la Terre', 'علوم الأرض', 'علوم الأرض'],
  ['medicine', 'Medicine', 'Médecine', 'الطب', 'الطب'],
  ['technology', 'Technology', 'Technologie', 'التكنولوجيا', 'التكنولوجيا'],
  ['computing', 'Computing', 'Informatique', 'الحوسبة', 'المعلوميات'],
  ['history', 'History', 'Histoire', 'التاريخ', 'التاريخ'],
  ['geography', 'Geography', 'Géographie', 'الجغرافيا', 'الجغرافيا'],
  ['art', 'Art', 'Art', 'الفن', 'الفن', 'Art', { fr: 'Catégorie:Art' }],
  ['music', 'Music', 'Musique', 'الموسيقى', 'الموسيقى'],
  ['literature', 'Literature', 'Littérature', 'الأدب', 'الأدب'],
  ['philosophy', 'Philosophy', 'Philosophie', 'الفلسفة', 'الفلسفة'],
  ['psychology', 'Psychology', 'Psychologie', 'علم النفس', 'علم النفس'],
  ['society', 'Society', 'Société', 'المجتمع', 'المجتمع'],
  ['nature', 'Nature & environment', 'Nature et environnement', 'الطبيعة والبيئة', 'الطبيعة والبيئة', 'Natural environment'],
  ['sports', 'Sports', 'Sport', 'الرياضة', 'الرياضة'],
  ['food', 'Food and drink', 'Cuisine et boissons', 'الطعام والشراب', 'الماكلة والشرب']
].map(([id, en, fr, ar, ary, category = en, categoryOverrides = {}]) => ({
  id, category: `Category:${category}`, categoryOverrides, labels: { en, fr, ar, ary }
}));

function topicLabel(id, language) {
  return TOPICS.find((topic) => topic.id === id)?.labels[language] || '';
}

function renderTopics() {
  $('topic-label').textContent = t('topic');
  $('topic-hint').textContent = t('topicHint');
  $('topic').replaceChildren(...[{ id: 'all', label: t('allTopics') }, ...TOPICS.map((topic) => ({
    id: topic.id, label: topic.labels[state.language]
  }))].map(({ id, label }) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    return option;
  }));
  $('topic').value = state.topic;
}

async function wikipediaQuery(language, parameters, signal) {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...parameters });
  const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params}`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Wikipedia request failed');
  const data = await response.json();
  if (data.error) throw new Error(data.error.info || 'Wikipedia API error');
  return data;
}

function topicUnavailable() {
  const error = new Error('No articles available for this topic and language');
  error.name = 'TopicUnavailableError';
  return error;
}

const categoryTitles = new Map();
const categoryMembers = new Map();
async function resolveTopicCategory(topic, language, signal) {
  // Some equivalent categories exist without a Wikipedia interlanguage link.
  if (topic.categoryOverrides[language]) return topic.categoryOverrides[language];
  if (language === 'en') return topic.category;
  const key = `${language}:${topic.id}`;
  if (categoryTitles.has(key)) return categoryTitles.get(key);
  const data = await wikipediaQuery('en', {
    prop: 'langlinks', titles: topic.category, redirects: '1', lllang: language, lllimit: '1'
  }, signal);
  const title = data.query?.pages?.[0]?.langlinks?.[0]?.title;
  if (!title) throw topicUnavailable();
  categoryTitles.set(key, title);
  return title;
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function readCategory(language, title, signal) {
  const key = `${language}:${title}`;
  if (categoryMembers.has(key)) return categoryMembers.get(key);
  const data = await wikipediaQuery(language, {
    list: 'categorymembers', cmtitle: title, cmnamespace: '0|14', cmtype: 'page|subcat', cmlimit: '500'
  }, signal);
  const members = data.query?.categorymembers || [];
  // Keep a bounded, per-visit cache. Random walks vary the subcategories on each click.
  if (categoryMembers.size >= 80) categoryMembers.delete(categoryMembers.keys().next().value);
  categoryMembers.set(key, members);
  return members;
}

// Extract generation is expensive on Wikipedia. Keep each request small.
const ARTICLE_BATCH_SIZE = 5;
const articleProperties = {
  prop: 'extracts|info|pageprops|pageimages', inprop: 'url', exintro: '1',
  piprop: 'thumbnail', pithumbsize: '650', explaintext: '1', exchars: '1200',
  exlimit: String(ARTICLE_BATCH_SIZE), ppprop: 'disambiguation'
};

function usablePages(data) {
  return (data.query?.pages || []).filter((page) => page.pageid > 0 && page.ns === 0 &&
    !page.missing && !page.redirect && !Object.hasOwn(page.pageprops || {}, 'disambiguation'));
}

async function discoverPages(language, topicId, signal) {
  if (topicId === 'all') {
    return usablePages(await wikipediaQuery(language, {
      ...articleProperties, generator: 'random', grnnamespace: '0', grnlimit: '5'
    }, signal));
  }
  const topic = TOPICS.find((item) => item.id === topicId);
  if (!topic) throw topicUnavailable();
  const root = await resolveTopicCategory(topic, language, signal);
  const branches = [{ title: root, depth: 0 }];
  const visited = new Set();
  const fallbackIds = new Set();
  let selectedIds = [];
  // Explore a bounded random branch, backtracking if a category has no articles.
  for (let attempt = 0; attempt < 6 && branches.length; attempt++) {
    const { title, depth } = branches.pop();
    if (visited.has(title)) { attempt--; continue; }
    visited.add(title);
    const members = await readCategory(language, title, signal);
    const ids = members.filter((member) => member.ns === 0).map((member) => member.pageid);
    ids.forEach((id) => fallbackIds.add(id));
    const subcategories = depth < 3 ? shuffled(members.filter((member) => member.ns === 14 && !visited.has(member.title))) : [];
    if (ids.length && (!subcategories.length || Math.random() < 0.35 || attempt === 5)) {
      selectedIds = ids;
      break;
    }
    branches.push(...subcategories.map((member) => ({ title: member.title, depth: depth + 1 })));
  }
  const candidates = shuffled(selectedIds.length ? selectedIds : [...fallbackIds]);
  if (!candidates.length) throw topicUnavailable();
  // Sample unseen pages first; keep seen pages as a fallback for small categories.
  candidates.sort((a, b) => Number(state.history.some((item) => item.lang === language && item.id === a)) -
    Number(state.history.some((item) => item.lang === language && item.id === b)));
  // Only request another small batch if the first contains no readable articles.
  for (let offset = 0; offset < Math.min(candidates.length, ARTICLE_BATCH_SIZE * 2); offset += ARTICLE_BATCH_SIZE) {
    const pages = usablePages(await wikipediaQuery(language, {
      ...articleProperties, pageids: candidates.slice(offset, offset + ARTICLE_BATCH_SIZE).join('|')
    }, signal));
    if (pages.length) return shuffled(pages);
  }
  throw topicUnavailable();
}
