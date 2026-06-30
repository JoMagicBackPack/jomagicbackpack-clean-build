(() => {
  const SOLD_RETENTION_DAYS = 14;
  const soldById = new Map();
  const soldTitlePhrases = [];
  let soldDataReady = false;
  let countTimer = null;

  const categoryLabels = new Map([
    ['New Arrivals', ['new']],
    ['Clothing', ['shirt','sweater','turtleneck','flannel','hoodie','jacket','coat','sport coat','blazer','vest','jeans','pants','shorts','board shorts','swim trunks','jersey','dress','apparel','top','tee']],
    ['Shoes', ['shoe','boot','sandal','sneaker','flat','loafer','slipper','heel','clog']],
    ['Accessories', ['bag','purse','hat','cap','jewelry','necklace','pendant','medal','pin','clip','watch','belt','scarf','glove','wallet','charm']],
    ['Kitchen & Dining', ['plate','bowl','mug','cup','glass','goblet','jar','canister','pitcher','creamer','sugar','salt','pepper','shaker','tray','kitchen','dining','serving']],
    ['Home Decor', ['blanket','quilt','vase','mirror','lamp','wall','decor','box','tin','plaque','tapestry','pillow','sculpture']],
    ['Toys & Character', ['toy','plush','doll','disney','pokemon','harry potter','star wars','breyer','figure']],
    ['Crafts', ['cross stitch','embroidery','needlepoint','craft','kit','fabric','yarn','sewing','pattern']],
    ['Books & Paper', ['book','manual','postcard','paper','magazine']],
    ['Collectibles', ['collectible','figurine','paperweight','memorabilia','vintage','statue','camera','religious','devotional','catholic','saint','mary','miraculous']]
  ]);

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

  function itemText(item) {
    return `${item.title || ''} ${(item.categories || []).map(c => c.categoryName || '').join(' ')} ${item.categoryOverride || ''}`.toLowerCase();
  }

  function itemIsSold(item) {
    const id = normalizeId(item.id || item.url || '');
    return Boolean((id && soldById.has(id)) || String(item.status || '').toLowerCase() === 'sold' || item.soldAt);
  }

  function itemIsNew(item) {
    const time = Date.parse(item.startTime || item.itemCreationDate || item.raw?.itemCreationDate || '');
    return Number.isFinite(time) && Date.now() - time <= 30 * 24 * 60 * 60 * 1000;
  }

  function itemMatchesLabel(item, label) {
    if (label === 'New Arrivals') return itemIsNew(item) && !itemIsSold(item);
    const words = categoryLabels.get(label) || [];
    if (!words.length) return false;
    const text = itemText(item);
    return words.some(word => text.includes(word));
  }

  async function applyActiveCounts() {
    const inventory = await readJson('data/inventory.json').catch(() => ({ items: [] }));
    const items = Array.isArray(inventory.items) ? inventory.items : [];
    const activeItems = items.filter(item => !itemIsSold(item));

    document.querySelectorAll('.category-wheel-center small').forEach(node => {
      node.textContent = `${activeItems.length} active finds`;
    });

    document.querySelectorAll('.category-card .category-title').forEach(title => {
      const count = title.querySelector('.category-count');
      if (!count) return;
      const label = title.textContent.replace(count.textContent, '').trim();
      count.textContent = String(activeItems.filter(item => itemMatchesLabel(item, label)).length);
    });
  }

  function clarifyAllItemsCopy() {
    document.querySelectorAll('.result-summary').forEach(summary => {
      summary.textContent = summary.textContent
        .replace(/items showing in All Items\./i, 'items shown in All Items, including recently sold pieces.')
        .replace(/item showing in All Items\./i, 'item shown in All Items.');
    });

    const desc = document.getElementById('products-description');
    if (desc && /Every active listing currently loaded/i.test(desc.textContent || '')) {
      desc.textContent = 'Available finds plus a small recently sold archive from the backpack.';
    }
  }

  function ensureAccessibleH1() {
    if (document.querySelector('h1')) return;
    const main = document.querySelector('main');
    if (!main) return;
    const h1 = document.createElement('h1');
    h1.className = 'sr-only';
    h1.textContent = 'Browse JoMagicBackpack Finds';
    main.prepend(h1);
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
    clarifyAllItemsCopy();
    applyActiveCounts().catch(() => {});
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
    ensureAccessibleH1();
    if (soldDataReady) document.querySelectorAll('.product-card').forEach(stampCard);
    clarifyAllItemsCopy();
  }

  function scheduleRefresh() {
    window.clearTimeout(countTimer);
    countTimer = window.setTimeout(() => {
      stampRenderedCards();
      applyActiveCounts().catch(() => {});
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureAccessibleH1();
    loadSoldData().catch(() => {
      soldDataReady = true;
      clarifyAllItemsCopy();
    });

    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
})();
