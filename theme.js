'use strict';

function renderThemeToggle() {
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  button.setAttribute('aria-pressed', String(dark));
  button.title = dark ? button.dataset.lightLabel : button.dataset.darkLabel;
}

(() => {
  const storageKey = 'zidni.theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch { /* The theme still works when browser storage is unavailable. */ }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#171e1a' : '#eeeae2';
    renderThemeToggle();
  }

  // Run in the head before the stylesheet to avoid a flash of the wrong theme.
  applyTheme(preference || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', (event) => {
    if (!preference) applyTheme(event.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderThemeToggle();
    document.getElementById('theme-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(preference);
      try { localStorage.setItem(storageKey, preference); }
      catch { /* Keep the choice for this visit if it cannot be saved. */ }
    });
  });
})();
