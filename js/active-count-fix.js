(() => {
  const labelKey = new Map([
    ['Clothing', 'clothing'], ['Shoes', 'footwear'], ['Accessories', 'accessories'],
    ['Kitchen & Dining', 'kitchen'], ['Home Decor', 'home'], ['Toys & Character', 'toys'],
    ['Crafts', 'crafts'], ['Books & Paper', 'books'], ['Collectibles', 'collectibles'], ['Other Finds', 'other']
  ]);
  const soldIds = new Set();
  const categoryLabels = new Map([
    ['New Arrivals', ['new']],
    ['Clothing', ['shirt','sweater','turtleneck','flannel','hoodie','jacket','coat','sport coat','blazer','vest','jeans','pants','shorts','board shorts','swim trunks','jersey','dress','apparel','top','tee']],
    ['Shoes', ['shoe','boot','sandal','sneaker','flat','loafer','slipper','heel','clog']],
    ['Accessories', ['bag','purse','hat','cap','jewelry','necklace','pendant','medal','pin','clip','watch','belt','scarf','glove','wallet','charm']],
    ['Kitchen & Dining', ['plate','bowl','mug','cup','glass','goblet','jar','carafe','canister','pitcher','creamer','sugar','salt','pepper','shaker','tray','kitchen','dining','serving']],
    ['Home Decor', ['blanket','quilt','vase','mirror','lamp','wall','decor','box','tin','plaque','tapestry','pillow','sculpture']],
    ['Toys & Character', ['toy','plush','doll','disney','pokemon','harry potter','star wars','breyer','figure']],
    ['Crafts', ['cross stitch','embroidery','needlepoint','craft','kit','fabric','yarn','sewing','pattern']],
    ['Books & Paper', ['book','hardcover','paperback','manual','postcard','paper','magazine','dust jacket']],
    ['Collectibles', ['collectible','figurine','paperweight','memorabilia','vintage','statue','camera','religious','devotional','catholic','saint','mary','miraculous']]
  ]);

  let activeItems = [];
  let allItems = [];
  let countTimer = null;

  const normalizeId = value => (String(value || '').match(/\b\d{9,15}\b/) || [''])[0];
  const itemText = item => `${item.title || ''} ${(item.categories || []).map(c => c.categoryName || '').join(' ')} ${item.categoryOverride || ''}`.toLowerCase();
  const isSold = item => soldIds.has(normalizeId(item.id || item.url || '')) || String(item.status || '').toLowerCase() === 'sold' || item.soldAt;
  const isNew = item => Date.now() - Date.parse(item.startTime || item.itemCreationDate || item.raw?.itemCreationDate || '') <= 30 * 24 * 60 * 60 * 1000;

  const matches = (item, label) => {
    if (label === 'New Arrivals') return isNew(item) && !isSold(item);
    if (item.categoryOverride) return item.categoryOverride === labelKey.get(label);
    const words = categoryLabels.get(label) || [];
    if (!words.length) return !Array.from(categoryLabels.keys()).some(other => other !== label && matches(item, other));
    const text = itemText(item).replace(/dust jacket/g, '');
    return words.some(word => text.includes(word));
  };

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(url);
    return response.json();
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
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

  async function loadCounts() {
    const [inventoryData, soldData] = await Promise.all([
      readJson('data/inventory.json'),
      readJson('data/sold-items.json').catch(() => ({ items: [] }))
    ]);
    (soldData.items || []).forEach(item => {
      const id = normalizeId(item.id || item.url || '');
      if (id) soldIds.add(id);
    });
    allItems = Array.isArray(inventoryData.items) ? inventoryData.items : [];
    activeItems = allItems.filter(item => !isSold(item));
  }

  function updateAllItemsSummary(activeCount, soldCount) {
    const activeWord = activeCount === 1 ? 'find' : 'finds';
    const soldWord = soldCount === 1 ? 'piece is' : 'pieces are';
    const message = soldCount > 0
      ? `${activeCount} active ${activeWord} for sale. ${soldCount} recently sold ${soldWord} also shown in All Items.`
      : `${activeCount} active ${activeWord} for sale in All Items.`;

    document.querySelectorAll('.result-summary').forEach(summary => {
      if (/All Items/i.test(summary.textContent || '')) setText(summary, message);
    });
  }

  function applyCounts() {
    ensureAccessibleH1();
    const activeCount = activeItems.length || allItems.filter(item => !isSold(item)).length;
    const soldCount = allItems.filter(item => isSold(item)).length;

    document.querySelectorAll('.category-wheel-center small').forEach(node => setText(node, `${activeCount} active finds`));
    document.querySelectorAll('.category-card .category-title').forEach(title => {
      const count = title.querySelector('.category-count');
      if (!count) return;
      const label = title.textContent.replace(count.textContent, '').trim();
      setText(count, String(activeItems.filter(item => matches(item, label)).length));
    });
    updateAllItemsSummary(activeCount, soldCount);
    const desc = document.getElementById('products-description');
    if (desc && /Every active listing currently loaded/i.test(desc.textContent || '')) {
      desc.textContent = 'Available finds plus a small recently sold archive from the backpack.';
    }
  }

  function scheduleApply() {
    window.clearTimeout(countTimer);
    countTimer = window.setTimeout(applyCounts, 80);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureAccessibleH1();
    loadCounts().then(applyCounts).catch(applyCounts);
    new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
})();
