'use strict';

function quickExcerpt(text, limit = 260) {
  const paragraph = text.trim().split(/\n+/)[0] || '';
  if (paragraph.length <= limit) return paragraph;
  const short = paragraph.slice(0, limit);
  const boundary = short.lastIndexOf(' ');
  return (boundary > limit * 0.6 ? short.slice(0, boundary) : short).trimEnd() + '…';
}

function hasArticleImage(article) {
  return typeof article.image === 'string' && /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(article.image) &&
    Number.isInteger(article.imageWidth) && Number.isInteger(article.imageHeight) && article.imageWidth > 0 && article.imageHeight > 0;
}

function isUpwardSwipe(start, end) {
  const distance = start.y - end.y;
  return distance >= 70 && distance > Math.abs(start.x - end.x) * 1.5 && end.time - start.time <= 1000;
}

// Reuse the other summaries from each small Wikipedia batch; no background requests.
function createDiscoveryQueue(loadPages) {
  let key = '';
  let pages = [];
  return async function nextPage(language, topic, signal, history, recent = []) {
    const nextKey = `${language}:${topic}`;
    if (nextKey !== key) { key = nextKey; pages = []; }
    const seen = recentArticleKeys(history, recent);
    const unseen = (items) => items.filter((page) => !seen.has(`${language}:${page.pageid}`));
    pages = unseen(pages);
    // Discard exhausted batches instead of recycling recently displayed pages.
    // Keep retries bounded, including for the unrestricted random generator.
    for (let attempt = 0; !pages.length && attempt < 3; attempt++) {
      try { pages = unseen(await loadPages(language, topic, signal)); }
      catch (error) { if (error.name !== 'TopicUnavailableError') throw error; }
    }
    const page = pages[0];
    if (!page) {
      const error = new Error('No unseen article found');
      error.name = 'TopicUnavailableError';
      throw error;
    }
    pages = pages.filter((item) => item.pageid !== page.pageid);
    return page;
  };
}

let quickArticleKey = '';
let quickAnimationTimer;

function renderQuickTexts() {
  const bindings = {
    'quick-eyebrow': 'quickEyebrow',
    'quick-title-a': 'quickTitleA', 'quick-title-b': 'quickTitleB', 'quick-description': 'quickDescription',
    'quick-empty-eyebrow': 'quickEmptyEyebrow', 'quick-empty-title': 'quickEmptyTitle',
    'quick-empty-description': 'quickEmptyDescription', 'quick-read-label': 'quickRead',
    'quick-swipe-hint': 'quickHint', 'quick-loading': 'loading',
    'quick-source': 'quickSource'
  };
  for (const [id, key] of Object.entries(bindings)) $(id).textContent = t(key);
  $('quick-view').setAttribute('aria-label', t('quickMode'));
  $('quick-topic').textContent = topicLabel(current ? current.topic : state.topic, state.language) || t('quickAllTopics');
  if (current) $('quick-time').textContent = t('excerpt', { count: Math.max(1, Math.ceil(current.extract.split(/\s+/).length / 200)) });
  renderQuickSave();
  setQuickBusy(busy);
}

function renderQuickSave() {
  const saved = current && isSaved(current);
  $('quick-save-label').textContent = t(saved ? 'kept' : 'save');
  $('quick-save').setAttribute('aria-pressed', String(Boolean(saved)));
}

function setQuickBusy(loading) {
  $('quick-card').setAttribute('aria-busy', String(loading));
  $('quick-loading').hidden = !loading;
  $('quick-next').disabled = loading;
  $('quick-save').disabled = loading || !current;
  $('quick-next-label').textContent = t(loading ? 'loading' : current ? 'quickNext' : 'quickStart');
  if (!loading) $('quick-card').classList.remove('is-leaving');
}

function renderQuickArticle(article) {
  $('quick-placeholder').hidden = Boolean(article);
  $('quick-content').hidden = !article;
  if (!article) return;
  $('quick-topic').textContent = topicLabel(article.topic, state.language) || t('quickAllTopics');
  $('quick-language').textContent = 'Wikipedia · ' + LANGUAGES[article.lang];
  $('quick-time').textContent = t('excerpt', { count: Math.max(1, Math.ceil(article.extract.split(/\s+/).length / 200)) });
  $('quick-article-title').textContent = article.title;
  $('quick-extract').textContent = quickExcerpt(article.extract) || t('noExtract');
  for (const id of ['quick-article-title', 'quick-extract']) {
    $(id).lang = article.lang;
    $(id).dir = isRtl(article.lang) ? 'rtl' : 'ltr';
  }
  $('quick-source').href = article.url;
  $('quick-read').href = article.url;
  $('quick-read').setAttribute('aria-label', t('quickRead') + ' · Wikipedia · ' + article.title);
  const image = $('quick-image');
  const validImage = hasArticleImage(article);
  image.hidden = true;
  $('quick-visual').classList.remove('has-image');
  if (validImage) {
    image.width = article.imageWidth;
    image.height = article.imageHeight;
    if (image.getAttribute('src') !== article.image) image.src = article.image;
    else if (image.complete && image.naturalWidth) {
      image.hidden = false;
      $('quick-visual').classList.add('has-image');
    }
  } else image.removeAttribute('src');
  const key = articleKey(article);
  if (quickArticleKey !== key) {
    const card = $('quick-card');
    clearTimeout(quickAnimationTimer);
    card.classList.remove('is-leaving', 'is-arriving');
    // Restart the entry animation, including when the next article was already cached.
    void card.offsetWidth;
    card.classList.add('is-arriving');
    quickAnimationTimer = setTimeout(() => card.classList.remove('is-arriving'), 320);
  }
  quickArticleKey = key;
  renderQuickSave();
}

function advanceQuick() {
  if (busy || $('explore-view').hidden) return;
  $('quick-card').classList.add('is-leaving');
  discover();
}

function initQuickDiscovery() {
  $('quick-next').addEventListener('click', advanceQuick);
  $('quick-save').addEventListener('click', () => { if (current && !busy) toggleSave(current); });
  $('quick-image').addEventListener('load', () => {
    $('quick-image').hidden = false;
    $('quick-visual').classList.add('has-image');
  });
  $('quick-image').addEventListener('error', () => {
    $('quick-image').hidden = true;
    $('quick-visual').classList.remove('has-image');
  });

  const card = $('quick-card');
  let gesture = null;
  function resetGesture() {
    gesture = null;
    card.classList.remove('is-dragging');
    card.style.removeProperty('transform');
    card.style.removeProperty('opacity');
  }
  card.addEventListener('pointerdown', (event) => {
    if (busy || !current || !event.isPrimary || event.button !== 0 || event.target.closest('button,a,input,select')) return;
    gesture = { x: event.clientX, y: event.clientY, time: event.timeStamp, pointer: event.pointerId };
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const distance = gesture.y - event.clientY;
    if (distance > 10 && distance > Math.abs(gesture.x - event.clientX) * 1.5) {
      card.classList.add('is-dragging');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        card.style.transform = `translateY(${-Math.min(distance * 0.45, 95)}px)`;
        card.style.opacity = String(Math.max(0.5, 1 - distance / 500));
      }
    }
  });
  card.addEventListener('pointerup', (event) => {
    if (!gesture || event.pointerId !== gesture.pointer) return;
    const advance = isUpwardSwipe(gesture, { x: event.clientX, y: event.clientY, time: event.timeStamp });
    resetGesture();
    if (advance) advanceQuick();
  });
  card.addEventListener('pointercancel', resetGesture);
  card.addEventListener('lostpointercapture', resetGesture);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && !event.target.closest('button,a')) {
      event.preventDefault(); advanceQuick();
    }
  });
  renderQuickArticle(current);
  discover();
}
