const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '..', 'theme.js'), 'utf8');
function harness({ dark = false, stored = null, readError = false, writeError = false } = {}) {
  const storage = new Map([['zidni.theme', stored], ['zidni.v1', 'existing notebook']]);
  const root = { dataset: {} };
  const meta = {};
  const handlers = {};
  let mounted = false;
  const button = {
    dataset: { lightLabel: 'Switch to light mode', darkLabel: 'Switch to dark mode' },
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { handlers[name] = handler; }
  };
  const system = { matches: dark, addEventListener(_name, handler) { handlers.system = handler; } };
  const context = vm.createContext({
    window: { matchMedia: () => system },
    localStorage: {
      getItem(key) { if (readError) throw new Error('Storage denied'); return storage.get(key); },
      setItem(key, value) { if (writeError) throw new Error('Storage denied'); storage.set(key, value); }
    },
    document: {
      documentElement: root,
      querySelector: () => meta,
      getElementById: () => mounted ? button : null,
      addEventListener(name, handler) { handlers[name] = handler; }
    }
  });
  vm.runInContext(source, context);
  return {
    root, meta, button, storage, context,
    mount() { mounted = true; handlers.DOMContentLoaded(); },
    click: () => handlers.click(),
    systemChange(matches) { system.matches = matches; handlers.system({ matches }); }
  };
}

test('applies the system theme before the body exists and initializes the toggle', () => {
  for (const dark of [false, true]) {
    const app = harness({ dark });
    assert.equal(app.root.dataset.theme, dark ? 'dark' : 'light');
    assert.equal(app.meta.content, dark ? '#171e1a' : '#eeeae2');
    app.mount();
    assert.equal(app.button.attributes['aria-pressed'], String(dark));
    assert.equal(app.button.title, dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
});

test('restores an explicit choice instead of the system theme', () => {
  assert.equal(harness({ dark: true, stored: 'light' }).root.dataset.theme, 'light');
  assert.equal(harness({ dark: false, stored: 'dark' }).root.dataset.theme, 'dark');
});

test('switching themes survives reload without changing the notebook', () => {
  const app = harness();
  app.mount();
  app.click();
  assert.equal(app.root.dataset.theme, 'dark');
  assert.equal(app.meta.content, '#171e1a');
  assert.equal(app.button.attributes['aria-pressed'], 'true');
  assert.equal(app.storage.get('zidni.theme'), 'dark');
  assert.equal(app.storage.get('zidni.v1'), 'existing notebook');
  assert.equal(harness({ stored: app.storage.get('zidni.theme') }).root.dataset.theme, 'dark');
  app.click();
  assert.equal(app.root.dataset.theme, 'light');
  assert.equal(app.meta.content, '#eeeae2');
  assert.equal(app.button.attributes['aria-pressed'], 'false');
  assert.equal(app.storage.get('zidni.theme'), 'light');
});

test('follows system changes only until a mode is explicitly chosen', () => {
  const app = harness();
  app.mount();
  app.systemChange(true);
  assert.equal(app.root.dataset.theme, 'dark');
  app.click();
  app.systemChange(true);
  assert.equal(app.root.dataset.theme, 'light');
  const restored = harness({ stored: 'dark' });
  restored.systemChange(false);
  assert.equal(restored.root.dataset.theme, 'dark');
});

test('invalid or unreadable preferences fall back to the system theme', () => {
  for (const stored of [null, '', 'auto', 'invalid']) {
    assert.equal(harness({ dark: true, stored }).root.dataset.theme, 'dark');
  }
  assert.equal(harness({ dark: true, readError: true }).root.dataset.theme, 'dark');
});

test('unavailable storage does not prevent switching or preserving the in-memory choice', () => {
  const app = harness({ readError: true, writeError: true });
  app.mount();
  assert.doesNotThrow(app.click);
  assert.equal(app.root.dataset.theme, 'dark');
  app.systemChange(false);
  assert.equal(app.root.dataset.theme, 'dark');
});

test('refreshes the localized action hint after language and theme changes', () => {
  const app = harness();
  app.mount();
  app.button.dataset.lightLabel = 'Passer au mode clair';
  app.button.dataset.darkLabel = 'Passer au mode sombre';
  app.context.renderThemeToggle();
  assert.equal(app.button.title, 'Passer au mode sombre');
  app.click();
  assert.equal(app.button.title, 'Passer au mode clair');
});
