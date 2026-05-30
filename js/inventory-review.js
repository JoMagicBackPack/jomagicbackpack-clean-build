document.addEventListener('DOMContentLoaded', () => {
  const seller = 'jomagicbackpack';
  const storeUrl = `https://www.ebay.com/str/${seller}`;
  const summary = document.getElementById('inventoryReviewSummary');
  const list = document.getElementById('inventoryIssueList');
  const status = document.getElementById('inventoryReviewStatus');
  const search = document.getElementById('reviewSearch');
  const filter = document.getElementById('reviewFilter');

  const categoryLabels = {
    clothing: 'Clothing',
    footwear: 'Shoes',
    accessories: 'Bags & Accessories',
    kitchen: 'Kitchen & Dining',
    home: 'Home Decor',
    toys: 'Toys & Character',
    crafts: 'Crafts',
    books: 'Books & Paper',
    collectibles: 'Collectibles',
    other: 'Other Finds'
  };

  let reviewItems = [];

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function categoryText(item) {
    return Array.isArray(item.categories)
      ? item.categories.map(category => category.categoryName || '').join(' ').toLowerCase()
      : '';
  }

  function hasAny(text, words = []) {
    return words.some(word => text.includes(word.toLowerCase()));
  }

  function assignedCategoryKey(item) {
    if (item.categoryOverride) return item.categoryOverride;

    const category = categoryText(item);
    const title = (item.title || '').toLowerCase();
    const allText = `${category} ${title}`;

    if (!category && /\b(shoes?|boots?|flats?|sandals?|loafers?|sneakers?|slippers?|heels?)\b/.test(title)) return 'footwear';
    if (!category && /\b(hats?|caps?|scarves?|wraps?|gloves?|belts?|purses?|handbags?|bags?|necklaces?|pendants?|cufflinks?|jewelry|pins?)\b/.test(title)) return 'accessories';
    if (!category && /\b(shirts?|t-?shirts?|tees?|sweaters?|hoodies?|jackets?|coats?|vests?|jeans|pants|shorts|jerseys?|dresses?)\b/.test(title)) return 'clothing';
    if (!category && /\b(cross stitch|embroidery|needlepoint|craft kit|ornament kit|activity books?|fabric|yarn|sewing|patterns?)\b/.test(title)) return 'crafts';
    if (!category && /\b(books?|manuals?|postcards?|paper|magazines?)\b/.test(title)) return 'books';
    if (!category && /\b(plates?|bowls?|mugs?|cups?|saucers?|goblets?|glasses?|drinkware|canisters?|jars?|pitchers?|creamers?|sugar bowl|salt and pepper|shakers?|casseroles?|cutting boards?|trivets?|coasters?|colanders?|ice cream maker)\b/.test(title)) return 'kitchen';
    if (!category && /\b(blankets?|quilts?|tapestr(?:y|ies)|vases?|mirrors?|lamps?|plaques?|wall|pillows?|suncatchers?|mobiles?|decor|decorative|boxes?|tins?)\b/.test(title)) return 'home';
    if (!category && /\b(toys?|plush|dolls?|disney|pokemon|harry potter|star wars|breyer|action figures?)\b/.test(title)) return 'toys';
    if (!category && /\b(figurines?|sculptures?|paperweights?|memorabilia|movie cameras?|statues?|figures?)\b/.test(title)) return 'collectibles';

    if (hasAny(category, ['athletic shoes', 'dress shoes', 'comfort shoes', 'boots', 'flats', "kids' shoes", 'sandals', 'casual shoes', 'heels', 'slippers'])) return 'footwear';
    if (hasAny(category, ['bags', 'handbags', 'cases', 'hats', 'necklaces', 'pendants', 'cufflinks', 'badges', 'pins', 'buttons', 'jewelry', 'watches', 'belts', 'gloves', 'scarves', 'wraps', 'hair extensions'])) return 'accessories';
    if (hasAny(category, ['activewear tops', 'casual shirts', 'button-down shirts', 't-shirts', 'sweaters', 'pants', 'jeans', 'coats', 'jackets', 'vests', 'suits', 'hoodies', 'sweatshirts', 'apparel', 'tops', 'polos', 'socks', 'shorts', 'jerseys', 'show shirts'])) return 'clothing';
    if (hasAny(category, ['cross stitch', 'embroidery', 'needlepoint', 'craft books', 'crafts', 'fabric', 'yarn', 'sewing', 'patterns']) || /\b(cross stitch|embroidery|needlepoint|craft kit|ornament kit|activity books)\b/.test(title)) return 'crafts';
    if (hasAny(category, ['books', 'antiquarian', 'manuals', 'postcards']) && hasAny(allText, ['book', 'books', 'manual', 'postcard', 'paper'])) return 'books';
    if (hasAny(category, ['plates', 'bowls', 'mugs', 'drinkware', 'glassware', 'shot glasses', 'dishes', 'teapots', 'gravy boats', 'casseroles', 'cup & saucers', 'canisters', 'jars', 'cutting boards', 'trays', 'colanders', 'strainers', 'pitchers', 'cream & sugar', 'creamers', 'napkin rings', 'kitchen tools', 'pottery & glass', 'trivets', 'coasters', 'salt & pepper shakers', 'ice buckets', 'cookie cutters', 'ice cream'])) return 'kitchen';
    if (hasAny(category, ['afghans', 'throw blankets', 'plaques', 'signs', 'suncatchers', 'mobiles', 'boxes', 'tins', 'ashtrays', 'tapestries', 'wood items', 'lights', 'decor', 'decorative', 'vases', 'wall', 'pillows', 'villages', 'houses', 'bells', 'lamp shades', 'quilts', 'mirrors', 'copper'])) return 'home';
    if (hasAny(category, ['bears', 'action figures', 'model horses', 'dumbo', 'animation', 'harry potter', 'party decorations', 'toys', 'ccg mixed card lots', 'vehicles']) || /\b(pokemon|disney|harry potter|gi joe|breyer|doll|plush|star wars)\b/.test(title)) return 'toys';
    if (hasAny(category, ['sculptures', 'figurines', 'paperweights', 'football-nfl', 'baseball-mlb', 'memorabilia', 'vintage', 'collectibles', 'decorative collectibles', 'indian', 'wedding supplies', 'binoculars', '1970s', 'canada', 'latin am', 'holiday collectibles', 'animals & nature', 'statues', 'figures', 'movie cameras', 'elves', 'gnomes', 'pixies'])) return 'collectibles';

    return 'other';
  }

  function priceValue(item) {
    if (typeof item.priceNumber === 'number') return item.priceNumber;
    const match = String(item.price || '').match(/[0-9]+(?:\.[0-9]+)?/);
    return match ? Number(match[0]) : 0;
  }

  function issueReasons(item) {
    const reasons = [];
    const category = categoryText(item);
    const assigned = assignedCategoryKey(item);

    if (!category && !item.categoryOverride) reasons.push({ key: 'category', label: 'Missing category' });
    if (!item.image) reasons.push({ key: 'image', label: 'Missing image' });
    if (!priceValue(item)) reasons.push({ key: 'price', label: 'Missing price' });
    if (assigned === 'other' && !item.categoryOverride) reasons.push({ key: 'other', label: 'Review Other Finds' });

    return reasons;
  }

  function makeReviewItem(item) {
    const assigned = assignedCategoryKey(item);
    const reasons = issueReasons(item);
    return {
      ...item,
      assigned,
      assignedLabel: categoryLabels[assigned] || 'Other Finds',
      categoryText: categoryText(item),
      reasons
    };
  }

  function issueMatches(item, query, activeFilter) {
    const haystack = [
      item.title,
      item.id,
      item.assignedLabel,
      item.categoryText,
      item.reasons.map(reason => reason.label).join(' ')
    ].join(' ').toLowerCase();

    const filterMatch = activeFilter === 'all' || item.reasons.some(reason => reason.key === activeFilter);
    const queryMatch = !query || haystack.includes(query);
    return filterMatch && queryMatch;
  }

  function renderSummary(items, visible) {
    const missingCategory = items.filter(item => item.reasons.some(reason => reason.key === 'category')).length;
    const missingImage = items.filter(item => item.reasons.some(reason => reason.key === 'image')).length;
    const missingPrice = items.filter(item => item.reasons.some(reason => reason.key === 'price')).length;

    summary.innerHTML = [
      ['Items checked', reviewItems.length],
      ['Need attention', items.length],
      ['Showing now', visible.length],
      ['Missing category', missingCategory],
      ['Missing image', missingImage],
      ['Missing price', missingPrice]
    ].map(([label, value]) => `
      <div class="inventory-review-stat">
        <strong>${value}</strong>
        <span>${label}</span>
      </div>
    `).join('');
  }

  function renderList(items) {
    if (!items.length) {
      list.innerHTML = '';
      status.hidden = false;
      status.textContent = 'Nothing matched this review filter.';
      return;
    }

    status.hidden = true;
    list.innerHTML = items.map(item => {
      const image = item.image
        ? `<img loading="lazy" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || 'Inventory item')}">`
        : 'No image';
      const categoryNames = item.categoryText ? item.categoryText : 'No eBay category received';
      const url = item.url || (item.id ? `https://www.ebay.com/itm/${encodeURIComponent(item.id)}` : storeUrl);
      const tags = [
        ...item.reasons.map(reason => reason.label),
        `Suggested: ${item.assignedLabel}`,
        item.id ? `Item ${item.id}` : 'No item ID',
        categoryNames
      ];

      return `
        <article class="inventory-issue-card">
          <div class="inventory-issue-image">${image}</div>
          <div class="inventory-issue-copy">
            <h2>${escapeHtml(item.title || 'Untitled item')}</h2>
            <div class="inventory-issue-tags">
              ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
            </div>
          </div>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open on eBay</a>
        </article>
      `;
    }).join('');
  }

  function render() {
    const query = (search?.value || '').trim().toLowerCase();
    const activeFilter = filter?.value || 'all';
    const issueItems = reviewItems.filter(item => item.reasons.length);
    const visible = issueItems.filter(item => issueMatches(item, query, activeFilter));

    renderSummary(issueItems, visible);
    renderList(visible);
  }

  async function loadInventory() {
    try {
      const response = await fetch('data/inventory.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Inventory file returned ${response.status}`);
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload.items || [];
      reviewItems = items.map(makeReviewItem);
      render();
    } catch (error) {
      summary.innerHTML = '';
      list.innerHTML = '';
      status.hidden = false;
      status.textContent = 'Inventory review could not load right now.';
      console.error(error);
    }
  }

  search?.addEventListener('input', render);
  filter?.addEventListener('change', render);
  loadInventory();
});
