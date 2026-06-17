(() => {
  const soldIds = new Set();
  const categoryLabels = new Map([
    ['New Arrivals', ['new']],
    ['Clothing', ['shirt','sweater','hoodie','jacket','coat','vest','jeans','pants','shorts','jersey','dress','apparel','top','tee']],
    ['Shoes', ['shoe','boot','sandal','sneaker','flat','loafer','slipper','heel']],
    ['Accessories', ['bag','purse','hat','cap','jewelry','necklace','pendant','pin','watch','belt','scarf','glove','wallet']],
    ['Kitchen & Dining', ['plate','bowl','mug','cup','glass','goblet','jar','canister','pitcher','creamer','sugar','salt','pepper','shaker','tray','kitchen','dining']],
    ['Home Decor', ['blanket','quilt','vase','mirror','lamp','wall','decor','box','tin','plaque','tapestry','pillow']],
    ['Toys & Character', ['toy','plush','doll','disney','pokemon','harry potter','star wars','breyer','figure']],
    ['Crafts', ['cross stitch','embroidery','needlepoint','craft','kit','fabric','yarn','sewing','pattern']],
    ['Books & Paper', ['book','manual','postcard','paper','magazine']],
    ['Collectibles', ['figurine','sculpture','paperweight','memorabilia','vintage','collectible','statue','camera']]
  ]);

  const normalizeId = value => (String(value || '').match(/\b\d{9,15}\b/) || [''])[0];
  const textOf = item => `${item.title || ''} ${(item.categories || []).map(c => c.categoryName || '').join(' ')}`.toLowerCase();
  const isSold = item => soldIds.has(normalizeId(item.id || item.url || '')) || String(item.status || '').toLowerCase() === 'sold' || item.soldAt;
  const isNew = item => Date.now() - Date.parse(item.startTime || item.itemCreationDate || item.raw?.itemCreationDate || '') <= 30 * 24 * 60 * 60 * 1000;
  const matches = (item, label) => {
    if (label === 'New Arrivals') return isNew(item);
    const words = categoryLabels.get(label) || [];
    if (!words.length) return !Array.from(categoryLabels.keys()).some(other => other !== label && matches(item, other));
    const text = textOf(item);
    return words.some(word => text.includes(word));
  };

  async function readJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(url);
    return response.json();
  }

  async function adjustCounts() {
    const [inventoryData, soldData] = await Promise.all([
      readJson('data/inventory.json'),
      readJson('data/sold-items.json').catch(() => ({ items: [] }))
    ]);
    (soldData.items || []).forEach(item => {
      const id = normalizeId(item.id || item.url || '');
      if (id) soldIds.add(id);
    });

    const items = Array.isArray(inventoryData.items) ? inventoryData.items : [];
    const activeItems = items.filter(item => !isSold(item));

    document.querySelectorAll('.category-wheel-center small').forEach(node => {
      node.textContent = `${activeItems.length} active finds`;
    });

    document.querySelectorAll('.category-card .category-title').forEach(title => {
      const count = title.querySelector('.category-count');
      if (!count) return;
      const label = title.textContent.replace(count.textContent, '').trim();
      count.textContent = activeItems.filter(item => matches(item, label)).length;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    adjustCounts().catch(() => {});
    new MutationObserver(() => adjustCounts().catch(() => {})).observe(document.body, { childList: true, subtree: true });
  });
})();
