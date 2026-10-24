'use strict';

const $ = (id) => document.getElementById(id);
let current = null;
let busy = false;
const storageKey = 'zidni.v1';
let state = { history: [], saved: [] };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  for (const name of ['history', 'saved']) {
    if (Array.isArray(stored?.[name])) state[name] = stored[name].filter(validArticle).slice(0, name === 'history' ? 60 : 500);
  }
} catch { /* Start with an empty notebook if storage is unavailable. */ }

function validArticle(article) {
  return article && article.lang === 'en' && Number.isInteger(article.id) &&
    typeof article.title === 'string' && typeof article.extract === 'string' &&
    typeof article.url === 'string' && article.url.startsWith('https://en.wikipedia.org/');
}
function articleKey(article) { return `${article.lang}:${article.id}`; }
function isSaved(article) { return state.saved.some((item) => articleKey(item) === articleKey(article)); }
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { notify('Storage is unavailable. Your notebook will last for this visit.'); }
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
}
function toggleSave(article) {
  if (isSaved(article)) state.saved = state.saved.filter((item) => articleKey(item) !== articleKey(article));
  else {
    if (state.saved.length >= 500) { notify('Your notebook is full. Remove a page to make room.'); return; }
    state.saved.unshift(article);
  }
  persist();
  renderNotebook();
}
function renderNotebook() {
  $('saved-count').textContent = state.saved.length;
  $('export-notebook').disabled = !state.saved.length;
  if (current) {
    $('save-current').textContent = isSaved(current) ? 'Saved' : 'Keep';
    $('save-current').setAttribute('aria-pressed', String(isSaved(current)));
  }
  if (state.history.length) {
    $('history-list').replaceChildren(...state.history.slice(0, 3).map((article) => {
      const button = document.createElement('button');
      button.className = 'history-link'; button.textContent = article.title;
      button.addEventListener('click', () => { showView(false); showArticle(article); });
      return button;
    }));
  }
  const query = foldSearch($('notebook-search').value.trim());
  const cards = state.saved.filter((article) => foldSearch(article.title + ' ' + article.extract).includes(query)).map((article) => {
    const card = document.createElement('article'); card.className = 'notebook-card';
    const title = document.createElement('h2'); title.textContent = article.title;
    const excerpt = document.createElement('p'); excerpt.textContent = article.extract.slice(0, 190) + (article.extract.length > 190 ? '…' : '');
    const link = document.createElement('a'); link.textContent = 'Keep reading ↗'; link.href = article.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const remove = document.createElement('button'); remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${article.title} from my notebook`);
    remove.addEventListener('click', () => toggleSave(article));
    card.append(title, excerpt, link, remove);
    return card;
  });
  if (!cards.length) {
    const empty = document.createElement('p'); empty.className = 'muted';
    empty.textContent = query ? 'No pages match that search. Try another word.' : 'Use Keep to save an article here.';
    cards.push(empty);
  }
  $('saved-list').replaceChildren(...cards);
}
function foldSearch(text) { return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(); }
function localDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function exportNotebook() {
  if (!state.saved.length) return;
  const text = ['MY ZIDNI NOTEBOOK', `Exported on ${localDay()}`, '', ...state.saved.flatMap((article) => [
    article.title, article.url, article.extract, 'Source: Wikipedia — CC BY-SA 4.0', '', '—', ''
  ])].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `zidni-notebook-${localDay()}.txt`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Your notebook has been exported.');
}

function showArticle(article) {
  current = article;
  $('empty').hidden = true;
  $('article').hidden = false;
  $('article-title').textContent = article.title;
  $('article-extract').replaceChildren(...article.extract.split(/\n+/).map((text) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    return paragraph;
  }));
  if (!article.extract) $('article-extract').textContent = 'No summary is available. Read the full article on Wikipedia.';
  $('article-link').href = article.url;
  $('reading-time').textContent = `Excerpt · ${Math.max(1, Math.ceil(article.extract.split(/\s+/).length / 200))} min`;
  $('discover').firstChild.textContent = 'Another page ';
  $('article-title').focus({ preventScroll: true });
  renderNotebook();
}

async function discover() {
  if (busy) return;
  busy = true;
  $('discover').disabled = true;
  $('discovery').setAttribute('aria-busy', 'true');
  $('loading').hidden = false;
  $('error').hidden = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const params = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', origin: '*',
      generator: 'random', grnnamespace: '0', grnlimit: '5',
      prop: 'extracts|info|pageprops', inprop: 'url', exintro: '1',
      explaintext: '1', exchars: '1200', ppprop: 'disambiguation'
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: controller.signal, credentials: 'omit'
    });
    if (!response.ok) throw new Error('Wikipedia request failed');
    const data = await response.json();
    const pages = (data.query?.pages || []).filter((page) => page.pageid > 0 && page.ns === 0 && !page.missing && !Object.hasOwn(page.pageprops || {}, 'disambiguation'));
    const unseen = pages.filter((page) => !state.history.some((item) => item.id === page.pageid));
    const pool = unseen.length ? unseen : pages;
    const page = pool.find((item) => item.extract?.length > 100) || pool[0];
    if (!page) throw new Error('No article found');
    const article = {
      id: page.pageid, lang: 'en', title: page.title, extract: page.extract || '',
      url: `https://en.wikipedia.org/?curid=${page.pageid}`
    };
    state.history = [article, ...state.history.filter((item) => articleKey(item) !== articleKey(article))].slice(0, 60);
    persist();
    showArticle(article);
    $('announcement').textContent = `New discovery: ${article.title}.`;
  } catch (error) {
    $('error').textContent = error.name === 'AbortError'
      ? 'Wikipedia is taking a while. Try again in a moment.'
      : 'Could not reach Wikipedia. Check your connection and try again.';
    $('error').hidden = false;
  } finally {
    clearTimeout(timeout);
    busy = false;
    $('discover').disabled = false;
    $('loading').hidden = true;
    $('discovery').setAttribute('aria-busy', 'false');
  }
}

$('discover').addEventListener('click', discover);
$('save-current').addEventListener('click', () => { if (current) toggleSave(current); });
$('nav-explore').addEventListener('click', () => showView(false));
$('nav-saved').addEventListener('click', () => showView(true));
$('notebook-search').addEventListener('input', renderNotebook);
$('export-notebook').addEventListener('click', exportNotebook);
document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); showView(false); });
renderNotebook();
