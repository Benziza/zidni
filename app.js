'use strict';

let current = null;
let busy = false;
const storageKey = 'zidni.v1';
const nextDiscoveryPage = createDiscoveryQueue(discoverPages);
const RECENT_ARTICLE_LIMIT = 1000;
let state = { history: [], recent: [], saved: [], daily: {}, language: 'en', topic: 'all' };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (LANGUAGES[stored?.language]) state.language = stored.language;
  if (stored?.topic === 'all' || TOPICS.some((topic) => topic.id === stored?.topic)) state.topic = stored.topic;
  if (stored?.daily && typeof stored.daily === 'object' && !Array.isArray(stored.daily)) {
    state.daily = Object.fromEntries(Object.entries(stored.daily).filter(([day, keys]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(keys)).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30));
  }
  for (const name of ['history', 'saved']) {
    if (Array.isArray(stored?.[name])) state[name] = stored[name].filter(validArticle).slice(0, name === 'history' ? 60 : 500);
  }
  // Migrate existing visits and retain only compact IDs for the longer memory.
  const recent = Array.isArray(stored?.recent) ? stored.recent.filter((key) =>
    typeof key === 'string' && /^(en|fr|ar|ary):[1-9]\d*$/.test(key)) : [];
  state.recent = [...recentArticleKeys(state.history, recent)].slice(0, RECENT_ARTICLE_LIMIT);
} catch { /* Start with an empty notebook if storage is unavailable. */ }

function validArticle(article) {
  return article && LANGUAGES[article.lang] && Number.isInteger(article.id) &&
    typeof article.title === 'string' && typeof article.extract === 'string' &&
    typeof article.url === 'string' && article.url.startsWith(`https://${article.lang}.wikipedia.org/`);
}
function articleKey(article) { return `${article.lang}:${article.id}`; }
function isSaved(article) { return state.saved.some((item) => articleKey(item) === articleKey(article)); }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { notify(t('storage')); }
}
let toastTimer;
function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function showView(saved) {
  $('explore-view').hidden = saved;
  $('saved-view').hidden = !saved;
  $('nav-explore').setAttribute('aria-current', saved ? 'false' : 'page');
  $('nav-saved').setAttribute('aria-current', saved ? 'page' : 'false');
  document.body.classList.toggle('quick-mode', !saved);
}
function toggleSave(article) {
  if (isSaved(article)) state.saved = state.saved.filter((item) => articleKey(item) !== articleKey(article));
  else {
    if (state.saved.length >= 500) { notify(t('full')); return; }
    state.saved.unshift(article);
  }
  persist();
  renderNotebook();
}
function renderNotebook() {
  $('saved-count').textContent = state.saved.length;
  $('export-notebook').disabled = !state.saved.length;
  renderQuickSave();
  const query = foldSearch($('notebook-search').value.trim());
  const cards = state.saved.filter((article) => foldSearch(article.title + ' ' + article.extract).includes(query)).map((article) => {
    const card = document.createElement('article'); card.className = 'notebook-card';
    const title = document.createElement('h2'); title.textContent = article.title; title.lang = article.lang; title.dir = isRtl(article.lang) ? 'rtl' : 'ltr';
    const excerpt = document.createElement('p'); excerpt.lang = article.lang; excerpt.dir = isRtl(article.lang) ? 'rtl' : 'ltr'; excerpt.textContent = article.extract.slice(0, 190) + (article.extract.length > 190 ? '…' : '');
    const link = document.createElement('a'); link.textContent = t('resume'); link.href = article.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const remove = document.createElement('button'); remove.textContent = t('remove');
    remove.setAttribute('aria-label', t('removePage', { title: article.title }));
    remove.addEventListener('click', () => toggleSave(article));
    card.append(title, excerpt, link, remove);
    return card;
  });
  if (!cards.length) {
    const empty = document.createElement('p'); empty.className = 'muted';
    empty.textContent = query ? t('noMatch') + ' ' + t('trySearch') : t('emptySaved');
    cards.push(empty);
  }
  $('saved-list').replaceChildren(...cards);
}
function foldSearch(text) { return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(); }
function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function countDiscovery(article) {
  const day = localDay();
  state.daily[day] = [...new Set([...(state.daily[day] || []), articleKey(article)])].slice(0, 60);
  state.daily = Object.fromEntries(Object.entries(state.daily).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30));
}
function exportNotebook() {
  if (!state.saved.length) return;
  const text = [t('exportTitle'), t('exportDate', { date: localDay() }), '', ...state.saved.flatMap((article) => [
    article.title, article.url, article.extract, t('exportCredit'), '', '—', ''
  ])].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `zidni-notebook-${localDay()}.txt`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify(t('exported'));
}

function showArticle(article) {
  current = article;
  renderQuickArticle(article);
  if (!$('explore-view').hidden) $('quick-article-title').focus({ preventScroll: true });
  renderNotebook();
}

async function discover() {
  if (busy) return;
  busy = true;
  $('language').disabled = true;
  $('topic').disabled = true;
  setQuickBusy(true);
  closeLanguageMenu();
  $('error').hidden = true;
  const language = state.language;
  const topic = state.topic;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const page = await nextDiscoveryPage(language, topic, controller.signal, state.history, state.recent);
    const article = {
      id: page.pageid, lang: language, topic, title: page.title, extract: page.extract || '',
      url: `https://${language}.wikipedia.org/?curid=${page.pageid}`, image: page.thumbnail?.source || '',
      imageWidth: page.thumbnail?.width, imageHeight: page.thumbnail?.height
    };
    state.history = [article, ...state.history.filter((item) => articleKey(item) !== articleKey(article))].slice(0, 60);
    state.recent = [articleKey(article), ...state.recent.filter((key) => key !== articleKey(article))].slice(0, RECENT_ARTICLE_LIMIT);
    countDiscovery(article);
    persist();
    showArticle(article);
    $('announcement').textContent = t('found', { title: article.title });
  } catch (error) {
    const kind = error.name === 'AbortError' ? 'timeout' : error.name === 'TopicUnavailableError' ? 'topicUnavailable' : 'offline';
    $('error').textContent = t(kind);
    $('error').dataset.kind = kind;
    $('error').hidden = false;
  } finally {
    clearTimeout(timeout);
    busy = false;
    $('language').disabled = false;
    $('topic').disabled = false;
    setQuickBusy(false);
  }
}

$('topic').addEventListener('change', () => {
  if (busy) return;
  state.topic = $('topic').value;
  $('error').hidden = true;
  persist();
  notify(t('nextTopic', { topic: state.topic === 'all' ? t('allTopics') : topicLabel(state.topic, state.language) }));
  discover();
});
$('nav-explore').addEventListener('click', () => showView(false));
$('nav-saved').addEventListener('click', () => showView(true));
$('notebook-search').addEventListener('input', renderNotebook);
$('export-notebook').addEventListener('click', exportNotebook);
$('how-link').addEventListener('click', () => {
  const open = $('how-it-works').hidden;
  $('how-it-works').hidden = !open;
  $('how-link').setAttribute('aria-expanded', String(open));
  if (open) $('how-it-works').scrollIntoView({ block: 'nearest' });
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !$('explore-view').hidden && !event.target.closest('input,button,a,select,textarea,[contenteditable=true]')) {
    event.preventDefault(); discover();
  }
});
document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); showView(false); });
applyLanguage();

initQuickDiscovery();
