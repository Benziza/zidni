'use strict';

const $ = (id) => document.getElementById(id);

function t(name, values = {}) {
  return (TEXTS[state.language]?.[name] || TEXTS.en[name] || name)
    .replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
}
function isRtl(language) { return language === 'ar' || language === 'ary'; }
function applyLanguage() {
  document.documentElement.lang = state.language;
  document.documentElement.dir = isRtl(state.language) ? 'rtl' : 'ltr';
  document.title = t('docTitle');
  document.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]').forEach((node) => { node.content = t('docTitle'); });
  for (let i = 1; i <= 4; i++) {
    document.querySelector(`.questions details:nth-child(${i}) summary`).textContent = t('q' + i);
    document.querySelector(`.questions details:nth-child(${i}) p`).textContent = t('a' + i);
  }
  const bindings = {
    'header>span': 'tagline', '#nav-explore': 'explore', '#saved-label': 'saved',
    '#saved-view>.eyebrow': 'savedEyebrow', '#saved-view>h1': 'saved',
    '#saved-view>p:not(.eyebrow)': 'collectionDescription', '#export-notebook': 'export',
    '.skip-link': 'skip', '.how-it-works .eyebrow': 'howEyebrow', '#how-title': 'howTitle',
    '.how-description': 'howDescription', '#how-link': 'howLink',
    'footer>span': 'footer', 'footer>a:last-child': 'thanks'
  };
  for (const [selector, name] of Object.entries(bindings)) {
    document.querySelectorAll(selector).forEach((node) => { node.textContent = t(name); });
  }
  document.querySelector('.brand').setAttribute('aria-label', t('home'));
  document.querySelector('nav').setAttribute('aria-label', t('nav'));
  $('notebook-search').placeholder = t('searchPlaceholder');
  $('notebook-search').setAttribute('aria-label', t('searchLabel'));
  if (!$('error').hidden) $('error').textContent = t($('error').dataset.kind || 'offline');
  if (current) showArticle(current);
  $('language-label').textContent = t('language');
  $('language').setAttribute('aria-label', t('languageLabel') + ': ' + LANGUAGES[state.language]);
  $('language-menu').setAttribute('aria-label', t('languageLabel'));
  $('language-current').textContent = LANGUAGES[state.language];
  $('language-current').lang = state.language;
  renderTopics();
  document.querySelectorAll('[data-language]').forEach((option) => option.setAttribute('aria-checked', String(option.dataset.language === state.language)));
  renderNotebook();
  renderQuickTexts();
}

const languageOptions = [...document.querySelectorAll('#language-menu [data-language]')];
function closeLanguageMenu(returnFocus = false) {
  $('language-menu').hidden = true;
  $('language').setAttribute('aria-expanded','false');
  if (returnFocus) $('language').focus();
}
function openLanguageMenu(index = languageOptions.findIndex((option) => option.dataset.language === state.language)) {
  if ($('language').disabled) return;
  $('language-menu').hidden = false;
  $('language').setAttribute('aria-expanded','true');
  const menu = $('language-menu');
  menu.style.transform = '';
  const bounds = menu.getBoundingClientRect();
  const shift = bounds.left < 12 ? 12 - bounds.left : Math.min(0, document.documentElement.clientWidth - 12 - bounds.right);
  menu.style.transform = `translateX(${shift}px)`;
  languageOptions[Math.max(0,index)].focus();
}
$('language').addEventListener('click', () => { if ($('language-menu').hidden) openLanguageMenu(); else closeLanguageMenu(true); });
$('language').addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openLanguageMenu(event.key === 'ArrowDown' ? 0 : languageOptions.length - 1); }
});
languageOptions.forEach((option) => {
  option.addEventListener('click', () => {
    if (busy) return;
    state.language = option.dataset.language;
    closeLanguageMenu(true); applyLanguage(); persist();
    notify(t('next', {language:LANGUAGES[state.language]}));
    discover();
  });
});
$('language-menu').addEventListener('keydown', (event) => {
  const index = languageOptions.indexOf(document.activeElement);
  let nextIndex;
  if (event.key === 'ArrowDown') nextIndex = (index + 1) % languageOptions.length;
  if (event.key === 'ArrowUp') nextIndex = (index - 1 + languageOptions.length) % languageOptions.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = languageOptions.length - 1;
  if (nextIndex !== undefined) { event.preventDefault(); languageOptions[nextIndex].focus(); }
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeLanguageMenu(true); }
  if (event.key === 'Tab') closeLanguageMenu(true);
});
document.addEventListener('click', (event) => { if (!$('language-picker').contains(event.target)) closeLanguageMenu(); });
document.addEventListener('focusin', (event) => { if (!$('language-picker').contains(event.target)) closeLanguageMenu(); });
window.addEventListener('resize', () => { if (!$('language-menu').hidden) closeLanguageMenu($('language-menu').contains(document.activeElement)); });
