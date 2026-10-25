'use strict';

let current = null;
let busy = false;
const storageKey = 'zidni.v1';
let state = { history: [], saved: [], fontSize: 18, daily: {}, language: 'en', topic: 'all' };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (LANGUAGES[stored?.language]) state.language = stored.language;
  if (stored?.topic === 'all' || TOPICS.some((topic) => topic.id === stored?.topic)) state.topic = stored.topic;
  if ([16,18,20,22,24].includes(stored?.fontSize)) state.fontSize = stored.fontSize;
  if (stored?.daily && typeof stored.daily === 'object' && !Array.isArray(stored.daily)) {
    state.daily = Object.fromEntries(Object.entries(stored.daily).filter(([day, keys]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(keys)).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30));
  }
  for (const name of ['history', 'saved']) {
    if (Array.isArray(stored?.[name])) state[name] = stored[name].filter(validArticle).slice(0, name === 'history' ? 60 : 500);
  }
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
  setQuietReading(false);
  $('explore-view').hidden = saved;
  $('saved-view').hidden = !saved;
  $('nav-explore').setAttribute('aria-current', saved ? 'false' : 'page');
  $('nav-saved').setAttribute('aria-current', saved ? 'page' : 'false');
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
  if (current) {
    $('save-current').textContent = t(isSaved(current) ? 'kept' : 'save');
    $('save-current').setAttribute('aria-pressed', String(isSaved(current)));
  }
  if (state.history.length) {
    $('history-list').replaceChildren(...state.history.slice(0, 3).map((article) => {
      const button = document.createElement('button');
      button.className = 'history-link'; button.textContent = article.title; button.lang = article.lang; button.dir = isRtl(article.lang) ? 'rtl' : 'ltr';
      button.addEventListener('click', () => { showView(false); showArticle(article); });
      return button;
    }));
  }
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
function renderDaily() {
  const count = Math.min(3, new Set(state.daily[localDay()] || []).size);
  $('daily-count').textContent = t('today', { count }) + (count === 3 ? ' ✓' : '');
  [...$('progress-dots').children].forEach((dot, index) => dot.classList.toggle('filled', index < count));
}
function countDiscovery(article) {
  const day = localDay();
  state.daily[day] = [...new Set([...(state.daily[day] || []), articleKey(article)])].slice(0, 60);
  state.daily = Object.fromEntries(Object.entries(state.daily).sort(([a], [b]) => b.localeCompare(a)).slice(0, 30));
  renderDaily();
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
  $('article-language').textContent = 'Wikipedia · ' + LANGUAGES[article.lang];
  $('article-topic').textContent = topicLabel(article.topic, state.language);
  $('article-topic').hidden = !$('article-topic').textContent;
  for (const id of ['article-title', 'article-extract']) { $(id).lang = article.lang; $(id).dir = isRtl(article.lang) ? 'rtl' : 'ltr'; }
  $('empty').hidden = true;
  $('article').hidden = false;
  $('article-title').textContent = article.title;
  $('article-extract').replaceChildren(...article.extract.split(/\n+/).map((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
  if (!article.extract) $('article-extract').textContent = t('noExtract');
  const image = $('article-image');
  $('article-figure').hidden = true;
  image.removeAttribute('src');
  if (typeof article.image === 'string' && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(article.image) && Number.isInteger(article.imageWidth) && Number.isInteger(article.imageHeight) && article.imageWidth > 0 && article.imageHeight > 0) {
    image.width = article.imageWidth; image.height = article.imageHeight;
    image.src = article.image;
    $('image-source').href = article.url;
    $('article-figure').hidden = false;
  }
  $('article-link').href = article.url;
  $('reading-time').textContent = t('excerpt', { count: Math.max(1, Math.ceil(article.extract.split(/\s+/).length / 200)) });
  $('discover-label').textContent = t('another');
  $('article-title').focus({ preventScroll: true });
  renderNotebook();
}

async function discover() {
  if (busy) return;
  busy = true;
  $('discover').disabled = true;
  $('language').disabled = true;
  $('topic').disabled = true;
  closeLanguageMenu();
  $('discovery').setAttribute('aria-busy', 'true');
  $('loading').hidden = false;
  $('error').hidden = true;
  const language = state.language;
  const topic = state.topic;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const pages = await discoverPages(language, topic, controller.signal);
    const unseen = pages.filter((page) => !state.history.some((item) => item.lang === language && item.id === page.pageid));
    const pool = unseen.length ? unseen : pages;
    const page = pool.find((item) => item.extract?.length > 100) || pool[0];
    if (!page) throw new Error('No article found');
    const article = {
      id: page.pageid, lang: language, topic, title: page.title, extract: page.extract || '',
      url: `https://${language}.wikipedia.org/?curid=${page.pageid}`, image: page.thumbnail?.source || '',
      imageWidth: page.thumbnail?.width, imageHeight: page.thumbnail?.height
    };
    state.history = [article, ...state.history.filter((item) => articleKey(item) !== articleKey(article))].slice(0, 60);
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
    $('discover').disabled = false;
    $('language').disabled = false;
    $('topic').disabled = false;
    $('loading').hidden = true;
    $('discovery').setAttribute('aria-busy', 'false');
  }
}

$('discover').addEventListener('click', discover);
$('topic').addEventListener('change', () => {
  if (busy) return;
  state.topic = $('topic').value;
  $('error').hidden = true;
  persist();
  notify(t('nextTopic', { topic: state.topic === 'all' ? t('allTopics') : topicLabel(state.topic, state.language) }));
});
$('save-current').addEventListener('click', () => { if (current) toggleSave(current); });
$('nav-explore').addEventListener('click', () => showView(false));
$('nav-saved').addEventListener('click', () => showView(true));
$('notebook-search').addEventListener('input', renderNotebook);
$('export-notebook').addEventListener('click', exportNotebook);
function applyTextSize() {
  document.documentElement.style.setProperty('--reading-size', `${state.fontSize}px`);
  $('font-size').textContent = `${state.fontSize} px`;
  $('font-smaller').disabled = state.fontSize <= 16;
  $('font-larger').disabled = state.fontSize >= 24;
}
function setQuietReading(enabled) {
  document.body.classList.toggle('quiet-reading', enabled);
  $('quiet-reading').setAttribute('aria-pressed', String(enabled));
  $('quiet-reading').textContent = t(enabled ? 'exitCalm' : 'calm');
  if (enabled) $('discovery').scrollIntoView({ block: 'start' });
}
$('font-smaller').addEventListener('click', () => { state.fontSize = Math.max(16, state.fontSize - 2); applyTextSize(); persist(); });
$('font-larger').addEventListener('click', () => { state.fontSize = Math.min(24, state.fontSize + 2); applyTextSize(); persist(); });
$('quiet-reading').addEventListener('click', () => setQuietReading(!document.body.classList.contains('quiet-reading')));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('quiet-reading')) {
    setQuietReading(false); $('quiet-reading').focus(); return;
  }
  if (event.code === 'Space' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !$('explore-view').hidden && !event.target.closest('input,button,a,select,textarea,[contenteditable=true]')) {
    event.preventDefault(); discover();
  }
});
document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); showView(false); });
applyLanguage();
applyTextSize();

renderDaily();
window.addEventListener('focus', renderDaily);

$('article-image').addEventListener('error', () => { $('article-figure').hidden = true; });

