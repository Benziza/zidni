'use strict';

function t(name, values = {}) {
  return (TEXTS[state.language]?.[name] || TEXTS.en[name] || name)
    .replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}
function isRtl(language) { return language === 'ar' || language === 'ary'; }
function applyLanguage() {
  document.documentElement.lang = state.language;
  document.documentElement.dir = isRtl(state.language) ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  const bindings = {
    'header>span': 'tagline', '#nav-explore': 'explore', '#saved-label': 'saved',
    '.intro .eyebrow': 'eyebrow', '.intro>p:last-of-type': 'description',
    '.paper-heading': 'paper', '.empty p': 'emptyDescription',
    '#article-link-label': 'read', '#credit-label': 'credit', '#loading': 'loading',
    '#recent-title': 'recent', '.daily-card .eyebrow': 'ritual', '.daily-card h2': 'ritualTitle',
    '#saved-view>.eyebrow': 'savedEyebrow', '#saved-view>h1': 'saved',
    '#saved-view>p:not(.eyebrow)': 'collectionDescription', '#export-notebook': 'export',
    'footer>span': 'footer', 'footer>a': 'thanks', '#image-source': 'imageCredit'
  };
  for (const [selector, name] of Object.entries(bindings)) {
    document.querySelectorAll(selector).forEach((node) => { node.textContent = t(name); });
  }
  for (const [selector, first, second] of [['.intro h1', 'titleA', 'titleB'], ['.empty h2', 'emptyA', 'emptyB']]) {
    const em = document.createElement('em'); em.textContent = t(second);
    document.querySelector(selector).replaceChildren(document.createTextNode(t(first)), document.createElement('br'), em);
  }
  document.querySelector('.brand').setAttribute('aria-label', t('home'));
  document.querySelector('nav').setAttribute('aria-label', t('nav'));
  $('discovery').setAttribute('aria-label', t('discovery'));
  $('notebook-search').placeholder = t('searchPlaceholder');
  $('notebook-search').setAttribute('aria-label', t('searchLabel'));
  document.querySelector('.reader-toolbar [role=group]').setAttribute('aria-label', t('fontGroup'));
  $('font-smaller').setAttribute('aria-label', t('smaller'));
  $('font-larger').setAttribute('aria-label', t('larger'));
  $('quiet-reading').textContent = t(document.body.classList.contains('quiet-reading') ? 'exitCalm' : 'calm');
  $('discover-label').textContent = t(current ? 'another' : 'discover');
  if (!$('error').hidden) $('error').textContent = t($('error').dataset.kind || 'offline');
  if (current) showArticle(current);
  if (!state.history.length) $('history-list').firstElementChild.textContent = t('emptyHistory');
  renderNotebook();
  renderDaily();
}
