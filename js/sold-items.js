(() => {
  const SOLD_RETENTION_DAYS = 14;
  const soldById = new Map();
  const soldTitlePhrases = [];
  let soldDataReady = false;

  function normalizeId(value = '') {
    const match = String(value).match(/\b\d{9,15}\b/);
    return match ? match[0] : '';
  }

  function isRecentSoldDate(soldAt, retentionDays = SOLD_RETENTION_DAYS) {
    const time = Date.parse(soldAt || '');
    if (!Number.isFinite(time)) return true;
    return Date.now() - time <= retentionDays * 24 * 60 * 60 * 1000;
  }

  function rememberSoldItem(item, retentionDays = SOLD_RETENTION_DAYS) {
    if (!item || !isRecentSoldDate(item.soldAt, retentionDays)) return;

    const id = normalizeId(item.id || item.url || '');
    if (id) soldById.set(id, item);

    const title = String(item.title || '').trim().toLowerCase();
    if (title) soldTitlePhrases.push(title);
  }

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  }

  async function loadSoldData() {
    const manual = await readJson('data/sold-items.json').catch(() => ({ items: [] }));
    const manualRetention = Number(manual.retentionDays || SOLD_RETENTION_DAYS);
    (manual.items || []).forEach(item => rememberSoldItem(item, manualRetention));

    const inventory = await readJson('data/inventory.json').catch(() => ({ items: [] }));
    (inventory.items || [])
      .filter(item => String(item.status || '').toLowerCase() === 'sold' || item.soldAt)
      .forEach(item => rememberSoldItem(item, SOLD_RETENTION_DAYS));

    soldDataReady = true;
    stampRenderedCards();
  }

  function cardLooksSold(card) {
    const hrefs = Array.from(card.querySelectorAll('a[href]')).map(link => link.href).join(' ');
    const id = normalizeId(hrefs);
    if (id && soldById.has(id)) return true;

    const title = String(card.querySelector('h3')?.textContent || '').trim().toLowerCase();
    return Boolean(title && soldTitlePhrases.some(phrase => title === phrase || title.includes(phrase) || phrase.includes(title)));
  }

  function stampCard(card) {
    if (!card || card.classList.contains('is-sold') || !cardLooksSold(card)) return;

    card.classList.add('is-sold');
    card.querySelector('.product-new-badge')?.remove();

    if (!card.querySelector('.product-sold-badge')) {
      card.insertAdjacentHTML('afterbegin', '<span class="product-sold-badge">Sold</span>');
    }

    const cta = card.querySelector('.product-cta');
    if (cta) cta.textContent = 'View sold listing';
  }

  function stampRenderedCards() {
    if (!soldDataReady) return;
    document.querySelectorAll('.product-card').forEach(stampCard);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSoldData().catch(() => {
      soldDataReady = true;
    });

    const observer = new MutationObserver(stampRenderedCards);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
