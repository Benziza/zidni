'use strict';

const $ = (id) => document.getElementById(id);
let current = null;
let busy = false;

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
    const page = pages.find((item) => item.extract?.length > 100) || pages[0];
    if (!page) throw new Error('No article found');
    const article = {
      id: page.pageid, lang: 'en', title: page.title, extract: page.extract || '',
      url: `https://en.wikipedia.org/?curid=${page.pageid}`
    };
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
