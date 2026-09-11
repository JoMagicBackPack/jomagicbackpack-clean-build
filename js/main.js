document.addEventListener('DOMContentLoaded', () => {
  const categoryIntro = document.getElementById('categoryIntro');
  const categoryShowcase = document.getElementById('categoryShowcase');
  const productPanel = document.getElementById('productPanel');
  const backToCategories = document.getElementById('backToCategories');
  const productsGrid = document.getElementById('productsGrid');
  const heading = document.getElementById('products-heading');
  const description = document.getElementById('products-description');
  const viewAllLink = document.getElementById('viewAllCategory');
  const inventorySearch = document.getElementById('inventorySearch');
  const inventorySort = document.getElementById('inventorySort');
  const resultSummary = document.getElementById('resultSummary');
  const productDetailsDialog = document.getElementById('productDetailsDialog');
  const productDetailsContent = document.getElementById('productDetailsContent');
  const closeProductDetails = document.getElementById('closeProductDetails');

  const seller = 'jomagicbackpack';
  const storeUrl = `https://www.ebay.com/str/${seller}`;
  const initialVisibleCount = 24;
  const loadMoreStep = 24;
  const newArrivalDays = 30;

  let storeInventory = null;
  let inventoryFetchPromise = null;
  let activeCategory = null;
  let activeItems = [];
  let visibleItemCount = initialVisibleCount;
  let categoryOpening = false;
  const detailCache = new Map();

  const categories = [
    {
      key: 'all',
      label: 'All Items',
      heading: 'All Items',
      description: 'Every active listing currently loaded from the backpack.',
      mood: 'Everything currently in the backpack.',
      viewQuery: ''
    },
    {
      key: 'new',
      label: 'New Arrivals',
      heading: 'New Arrivals',
      description: 'Freshly added pieces from the last month.',
      mood: 'The newest things to tumble out of the backpack.',
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      heading: 'Clothing',
      description: 'Shirts, sweaters, jackets, pants, jeans, suits, and apparel.',
      mood: 'Wearable finds from the backpack.',
      viewQuery: 'shirt jacket sweater pants'
    },
    {
      key: 'footwear',
      label: 'Shoes',
      heading: 'Shoes',
      description: 'Shoes, boots, flats, sneakers, and sandals.',
      mood: 'Footwear for every kind of wandering.',
      viewQuery: 'shoes boots sneakers sandals'
    },
    {
      key: 'accessories',
      label: 'Accessories & Wearables',
      heading: 'Accessories & Wearables',
      description: 'Bags, hats, jewelry, pins, watches, belts, and smaller wearable details.',
      mood: 'The smaller details that complete the picture.',
      viewQuery: 'bag wallet hat jewelry accessories'
    },
    {
      key: 'kitchen',
      label: 'Kitchen & Dining',
      heading: 'Kitchen & Dining',
      description: 'Plates, bowls, mugs, glassware, serving pieces, and kitchen tools.',
      mood: 'Kitchenware, tableware, and culinary curiosities.',
      viewQuery: 'plate bowl mug kitchen cookware'
    },
    {
      key: 'home',
      label: 'Home Decor',
      heading: 'Home Decor',
      description: 'Blankets, wall decor, vases, lights, tapestries, boxes, and display pieces.',
      mood: 'Pieces that make a room feel found, not furnished.',
      viewQuery: 'home decor blanket vase wall art'
    },
    {
      key: 'toys',
      label: 'Toys & Character',
      heading: 'Toys & Character',
      description: 'Bears, action figures, dolls, Disney, Harry Potter, animation, and playful finds.',
      mood: 'Nostalgia, characters, and playful shelf treasures.',
      viewQuery: 'toy bear doll disney pokemon'
    },
    {
      key: 'crafts',
      label: 'Crafts',
      heading: 'Crafts',
      description: 'Cross stitch, embroidery kits, craft books, and handmade project supplies.',
      mood: 'Kits, stitches, patterns, and hands-on finds.',
      viewQuery: 'cross stitch embroidery craft kit'
    },
    {
      key: 'books',
      label: 'Books & Paper',
      heading: 'Books & Paper',
      description: 'Books, collectible paper, ephemera, and printed pieces.',
      mood: 'Printed finds with a little history in them.',
      viewQuery: 'book vintage paper collectible'
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      heading: 'Collectibles',
      description: 'Figurines, sculptures, sports, vintage display pieces, and category-resistant treasures.',
      mood: 'Relics, oddities, atmosphere, and display-worthy finds.',
      viewQuery: 'vintage collectible art decor oddities'
    },
    {
      key: 'other',
      label: 'Other Finds',
      heading: 'Other Finds',
      description: 'Items that do not neatly belong in the other backpack pockets.',
      mood: 'The pleasantly hard-to-file discoveries.',
      viewQuery: ''
    }
  ];

  function ebaySearchUrl(query) {
    const url = new URL('https://www.ebay.com/sch/i.html');
    url.searchParams.set('_ssn', seller);
    if (query) url.searchParams.set('_nkw', query);
    url.searchParams.set('_sop', '10');
    return url.toString();
  }

  function inventoryUrl() {
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('seller', seller);
    url.searchParams.set('q', 'a');
    url.searchParams.set('limit', '50');
    url.searchParams.set('pages', '6');
    url.searchParams.set('sort', 'new');
    return url.toString();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (cell || row.length) rows.push([...row, cell]);
        row = [];
        cell = '';
        if (char === '\r' && next === '\n') i += 1;
      } else {
        cell += char;
      }
    }

    if (cell || row.length) rows.push([...row, cell]);
    if (rows.length < 2) return [];

    const headers = rows[0].map(header => header.trim().toLowerCase());

    return rows.slice(1).map(values => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });

      return normalizeCsvItem(record);
    }).filter(item => item.title);
  }

  function pick(record, names) {
    for (const name of names) {
      const value = record[name];
      if (value) return value.trim();
    }
    return '';
  }

  function normalizeCsvItem(record) {
    const itemNumber = pick(record, ['item number', 'item id', 'id']);
    const title = pick(record, ['title', 'item title', 'name']);
    const rawPrice = pick(record, ['current price', 'start price', 'price', 'buy it now price']);
    const price = Number(String(rawPrice).replace(/[^0-9.]/g, ''));
    const categoryName = pick(record, ['ebay category 1 name', 'category', 'store category', 'category name']);
    const startTime = pick(record, ['start date', 'start time', 'item creation date']);

    return {
      id: itemNumber || pick(record, ['custom label (sku)', 'custom label']),
      title,
      price: Number.isFinite(price) && price > 0 ? `USD ${price.toFixed(2)}` : null,
      condition: pick(record, ['condition']) || null,
      image: pick(record, ['image', 'image url', 'picture url', 'photo url']) || null,
      url: pick(record, ['url', 'item url', 'link']) || (itemNumber ? `https://www.ebay.com/itm/${itemNumber}` : storeUrl),
      seller,
      startTime,
      categories: categoryName ? [{ categoryName }] : [],
      raw: record
    };
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

  function belongsInCategory(item, category) {
    if (!category) return false;
    if (category.key === 'new') return isNewArrival(item);
    return category.key === 'all' || assignedCategoryKey(item) === category.key;
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.id || item.url || item.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function itemTime(item) {
    const rawTime = item.startTime || item.itemCreationDate || item.raw?.itemCreationDate || item.raw?.itemOriginDate || '';
    const parsed = Date.parse(rawTime);
    if (parsed) return parsed;

    const ebayDate = String(rawTime).match(/^([A-Za-z]{3})-(\d{1,2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+([A-Z]{3})$/);
    if (!ebayDate) return 0;

    const [, monthName, day, year, hour, minute, second, zone] = ebayDate;
    const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName.toLowerCase());
    if (monthIndex < 0) return 0;
    const zoneOffset = { PST: '-08:00', PDT: '-07:00', MST: '-07:00', MDT: '-06:00', CST: '-06:00', CDT: '-05:00', EST: '-05:00', EDT: '-04:00' }[zone] || 'Z';
    return Date.parse(`20${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:${second}${zoneOffset}`) || 0;
  }

  function isNewArrival(item) {
    const time = itemTime(item);
    if (!time) return false;
    return Date.now() - time <= newArrivalDays * 24 * 60 * 60 * 1000;
  }

  function isActiveItem(item) {
    const state = String(item?.status || item?.listingStatus || item?.raw?.status || '').toLowerCase();
    const availability = Array.isArray(item?.raw?.estimatedAvailabilities)
      ? item.raw.estimatedAvailabilities.map(value => String(value?.estimatedAvailabilityStatus || '').toUpperCase()) : [];
    const endDate = Date.parse(item?.endTime || item?.itemEndDate || item?.raw?.itemEndDate || '');
    return !item?.soldAt && !['sold', 'ended', 'out_of_stock'].includes(state)
      && !(Number.isFinite(endDate) && endDate <= Date.now())
      && !(availability.length && availability.every(value => value === 'OUT_OF_STOCK'));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function priceValue(item) {
    if (typeof item.priceNumber === 'number') return item.priceNumber;
    const match = String(item.price || '').match(/[0-9]+(?:\.[0-9]+)?/);
    return match ? Number(match[0]) : 0;
  }

  function sortNewestFirst(items) {
    return [...items].sort((a, b) => itemTime(b) - itemTime(a));
  }

  function sortItems(items) {
    const mode = inventorySort?.value || 'featured';
    const sorted = [...items];
    if (mode === 'price-low') sorted.sort((a, b) => priceValue(a) - priceValue(b));
    if (mode === 'price-high') sorted.sort((a, b) => priceValue(b) - priceValue(a));
    if (mode === 'title') sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    if (mode === 'featured') sorted.sort((a, b) => itemTime(b) - itemTime(a));
    return sorted;
  }

  async function fetchStoreInventory() {
    if (storeInventory) return storeInventory;
    if (inventoryFetchPromise) return inventoryFetchPromise;

    inventoryFetchPromise = fetch(inventoryUrl())
      .then(response => response.json())
      .then(data => {
        if (!data.ok || !data.result || !Array.isArray(data.result.items)) throw new Error('Live feed failed.');
        const liveItems = uniqueItems(data.result.items);
        if (liveItems.length < 100) throw new Error('Live feed returned too few items.');
        storeInventory = sortNewestFirst(liveItems.filter(isActiveItem));
        return storeInventory;
      })
      .catch(() => fetch('data/inventory.json')
        .then(response => {
          if (!response.ok) throw new Error('JSON inventory did not load.');
          return response.json();
        })
        .then(data => {
          storeInventory = sortNewestFirst(uniqueItems(data.items || []).filter(isActiveItem));
          return storeInventory;
        })
        .catch(() => fetch('data/inventory.csv')
          .then(response => {
            if (!response.ok) throw new Error('CSV inventory did not load.');
            return response.text();
          })
          .then(text => {
            storeInventory = sortNewestFirst(uniqueItems(parseCsv(text)).filter(isActiveItem));
            return storeInventory;
          })))
      .finally(() => {
        inventoryFetchPromise = null;
      });

    return inventoryFetchPromise;
  }

  function categoryCount(category) {
    if (!storeInventory) return '';
    const count = storeInventory.filter(item => belongsInCategory(item, category)).length;
    return `<span class="category-count">${count}</span>`;
  }

  function renderCategories() {
    if (!categoryShowcase) return;
    const outerCategories = categories.filter(category => category.key !== 'all');
    const centerLabel = storeInventory ? `${storeInventory.length} active finds` : 'loading finds';
    const totalCategories = outerCategories.length;
    const cards = outerCategories.map((category, index) => {
      const angle = (360 / totalCategories) * index;
      return `
      <button class="category-card" type="button" data-category="${category.key}" data-angle="${angle}" style="--angle: ${angle}deg; --reverse-angle: ${-angle}deg;">
        <span class="category-emblem category-icon-${category.key}" aria-hidden="true"></span>
        <span class="category-title">${category.label} ${categoryCount(category)}</span>
        <span class="category-description">${category.mood}</span>
        <span class="category-spark category-spark-one" aria-hidden="true"></span>
        <span class="category-spark category-spark-two" aria-hidden="true"></span>
        <span class="category-spark category-spark-three" aria-hidden="true"></span>
      </button>
    `;
    }).join('');
    categoryShowcase.innerHTML = `
      <button class="category-wheel-center" type="button" data-category="all" aria-label="Show all items">
        <img class="category-center-backpack" src="AF33BEB9-4375-48AE-B35A-07DF95F39F98.png" alt="">
        <span class="category-wheel-title">All Items</span>
        <small>${centerLabel}</small>
        <span class="category-spark category-spark-one" aria-hidden="true"></span>
        <span class="category-spark category-spark-two" aria-hidden="true"></span>
        <span class="category-spark category-spark-three" aria-hidden="true"></span>
      </button>
      <div class="category-open-effect" aria-hidden="true">
        <span class="open-spark spark-one"></span>
        <span class="open-spark spark-two"></span>
        <span class="open-spark spark-three"></span>
        <img src="AF33BEB9-4375-48AE-B35A-07DF95F39F98.png" alt="">
      </div>
      ${cards}
    `;
  }

  function showProductPanel(category) {
    if (!categoryIntro || !categoryShowcase || !productPanel) return;
    activeCategory = category;
    categoryIntro.hidden = true;
    categoryShowcase.hidden = true;
    productPanel.hidden = false;
    productPanel.classList.add('is-visible');

    if (heading) heading.textContent = category.heading;
    if (description) description.textContent = category.description;
    if (inventorySearch) inventorySearch.value = '';
    if (inventorySort) inventorySort.value = 'featured';

    if (viewAllLink) {
      viewAllLink.href = category.key === 'all' || category.key === 'new' ? storeUrl : ebaySearchUrl(category.viewQuery || '');
      viewAllLink.textContent = category.key === 'all'
        ? 'View all items on eBay'
        : category.key === 'new'
          ? 'View newest items on eBay'
          : `View all ${category.label} on eBay`;
    }
  }

  function showCategoryPanel() {
    if (!categoryIntro || !categoryShowcase || !productPanel) return;
    productPanel.hidden = true;
    productPanel.classList.remove('is-visible');
    categoryIntro.hidden = false;
    categoryShowcase.hidden = false;
    activeCategory = null;
    activeItems = [];
    visibleItemCount = initialVisibleCount;
    if (productsGrid) productsGrid.innerHTML = '';
    if (resultSummary) resultSummary.textContent = '';
  }

  function categoryFromKey(key) {
    return categories.find(category => category.key === key);
  }

  function categoryFromHash() {
    const key = decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
    return key ? categoryFromKey(key) : null;
  }

  function baseCategoryUrl() {
    return `${window.location.pathname}${window.location.search}`;
  }

  function setCategoryHistory(category, mode = 'push') {
    if (!categoryShowcase || !window.history?.pushState) return;
    const url = category ? `#${encodeURIComponent(category.key)}` : baseCategoryUrl();
    const state = { categoryKey: category ? category.key : null };
    const method = mode === 'replace' ? 'replaceState' : 'pushState';

    if (category && window.location.hash === url && window.history.state?.categoryKey === category.key) return;
    if (!category && !window.location.hash && window.history.state?.categoryKey === null) return;
    window.history[method](state, '', url);
  }

  function showCategoryPanelFromButton() {
    setCategoryHistory(null, 'replace');
    showCategoryPanel();
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
  }

  function itemSearchText(item) {
    return [
      item.title,
      item.condition,
      item.seller,
      assignedCategoryKey(item),
      categoryText(item)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function visibleItems() {
    const term = (inventorySearch?.value || '').trim().toLowerCase();
    const filtered = activeItems.filter(item => !term || itemSearchText(item).includes(term));
    return sortItems(filtered);
  }

  function productCardMarkup(item) {
    const imageMarkup = item.image
      ? `<img loading="lazy" src="${item.image}" alt="${item.title || 'JoMagicBackpack item'}">`
      : `<span class="product-image-fallback">No image yet</span>`;
    const category = categories.find(entry => entry.key === assignedCategoryKey(item));
    const newBadge = isNewArrival(item) ? '<span class="product-new-badge">New Arrival</span>' : '';

    return `
      <article class="product-card" data-item-id="${item.id || ''}" tabindex="0" role="button" aria-label="View details for ${escapeHtml(item.title || 'JoMagicBackpack item')}">
        ${newBadge}
        <button class="product-image product-card-open" type="button" aria-hidden="true">
          ${imageMarkup}
        </button>
        <div class="product-meta">${category ? category.label : 'Other Finds'}</div>
        <h3>${item.title || 'JoMagicBackpack item'}</h3>
        ${item.price ? `<p class="price">${item.price}</p>` : ''}
        <div class="product-actions">
          <button class="product-details-trigger" type="button" data-item-id="${item.id || ''}"><span class="backpack-icon" aria-hidden="true">&#x1F392;</span> Expand for details</button>
          <a class="product-cta product-ebay-cta" data-ga4-outbound="ebay" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer"><span class="ebay-wordmark" aria-hidden="true"><span>e</span><span>b</span><span>a</span><span>y</span></span><span>View on eBay</span></a>
        </div>
      </article>
    `;
  }

  const privateDetailNames = /(?:acquisition|purchase cost|owner note|research note|confidence|provenance|approval|policy id|sku|inventory|internal|package template)/i;
  const measurementNames = /(?:measurement|\b(length|width|height|depth|diameter|waist|inseam|rise|shoulder|sleeve|pit to pit|opening|overall|circumference|capacity|weight)\b)/i;
  const measurementValue = /(?:\b\d+(?:\.\d+)?\s*(?:in(?:ches)?|cm|mm|ft|feet|oz|lb|lbs|pounds?|ml|l|liters?|gal|gallons?|qt|quarts?)\b|\b\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?(?:\s*(?:x|×)\s*\d+(?:\.\d+)?)?\s*(?:in(?:ches)?|cm|mm|ft)\b)/i;

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function buyerText(value) {
    const withLines = String(value || '')
      .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' ');
    const decoder = document.createElement('textarea');
    decoder.innerHTML = withLines;
    return decoder.value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function listingDescription(value) {
    return buyerText(value).split(/(?:Thanks for taking a peek in my magic backpack!|Processing and Shipping Info:)/i)[0].trim();
  }

  function descriptionRows(value) {
    const text = buyerText(value);
    const rows = text.split('\n').map(line => line.trim()).reduce((found, line) => {
      const match = line.match(/^([A-Za-z][A-Za-z /&()-]{1,36}):\s*(.{1,180})$/);
      if (match && !privateDetailNames.test(match[1])) found.push([match[1].trim(), match[2].trim()]);
      return found;
    }, []);
    const inlinePattern = /\b(pit to pit|p2p|sleeve(?: length)?|length|shoulder(?: to shoulder)?|waist|chest|diameter|height|opening)\b[^\d]{0,45}(\d+(?:\.\d+)?\s*(?:in(?:ches)?|cm|mm|ft|feet))/gi;
    let match;
    while ((match = inlinePattern.exec(text))) {
      const label = match[1].replace(/^p2p$/i, 'Pit to pit').replace(/\b\w/g, character => character.toUpperCase());
      rows.push([label, match[2]]);
    }
    return rows;
  }

  function mergeRows(...groups) {
    const unique = new Map();
    groups.flat().forEach(([name, value]) => {
      const label = cleanText(name); const text = cleanText(value);
      if (label && text && !privateDetailNames.test(label) && !unique.has(label.toLowerCase())) unique.set(label.toLowerCase(), [label, text]);
    });
    return [...unique.values()];
  }

  function detailRows(item) {
    const raw = item.raw || {};
    const aspects = Array.isArray(raw.localizedAspects) ? raw.localizedAspects : [];
    const known = [
      ['Brand', item.brand || raw.brand], ['Material', item.material || raw.material],
      ['Color', item.color || raw.color], ['Size', item.size || raw.size], ['Style', item.style || raw.style], ['Model', item.model || raw.model],
      ['Type', item.type || raw.type], ['Pattern', item.pattern || raw.pattern], ['Shape', item.shape || raw.shape],
      ['Theme', item.theme || raw.theme], ['Features', item.features || raw.features], ['Room', item.room || raw.room]
    ];
    aspects.forEach(aspect => {
      const name = aspect.name || aspect.localizedName;
      const value = aspect.value || aspect.localizedValue;
      if (name && value) known.push([name, value]);
    });
    return mergeRows(known.map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]));
  }

  function isMeasurementRow(name, value) {
    return measurementNames.test(name) && measurementValue.test(value);
  }

  function displayDetailName(name, value) {
    if (/^sleeve length$/i.test(name) && !isMeasurementRow(name, value)) return 'Sleeve Type';
    return name;
  }

  function measurementRows(rows) {
    return rows.filter(([name, value]) => isMeasurementRow(name, value));
  }

  function curatedRows(rows) {
    return rows.filter(([name, value]) => !isMeasurementRow(name, value)).map(([name, value]) => [displayDetailName(name, value), value]);
  }

  function quickRows(item, rows) {
    const preferred = /^(Brand|Material|Color|Size|Style|Type|Shape|Pattern|Features|Room|Theme)$/i;
    const picked = rows.filter(([name]) => preferred.test(name)).slice(0, 5);
    if (item.condition && item.condition !== 'â€”' && picked.length < 6) picked.push(['Condition', item.condition]);
    return picked.slice(0, 6);
  }

  function detailImages(item) {
    const raw = item.raw || {};
    const candidates = [item.image, ...(item.images || []), raw.image?.imageUrl, ...(raw.additionalImages || []).map(image => image?.imageUrl), ...(raw.thumbnailImages || []).map(image => image?.imageUrl)];
    return [...new Set(candidates.filter(Boolean))];
  }

  function itemDetailUrl(item) {
    const rawId = String(item?.raw?.itemId || item?.id || '');
    const id = /^\d{9,15}$/.test(rawId) ? `v1|${rawId}|0` : rawId;
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('item_id', id);
    return url.toString();
  }

  async function hydrateItemDetails(item) {
    const key = String(item?.raw?.itemId || item?.id || '');
    if (!key) return item;
    if (detailCache.has(key)) return detailCache.get(key);
    const request = fetch(itemDetailUrl(item), { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => data?.ok && data?.result?.item ? { ...item, ...data.result.item, id: String(data.result.item.id || item.id) } : item)
      .catch(() => item);
    detailCache.set(key, request);
    return request;
  }

  function galleryMarkup(images, title) {
    if (!images.length) return '<div class="product-image-fallback">No image available</div>';
    return `<div class="product-detail-hero"><img data-detail-selected-image src="${escapeHtml(images[0])}" alt="${escapeHtml(title)}"></div><div class="product-detail-thumbnails">${images.map((image, index) => `<button type="button" class="product-detail-thumbnail${index === 0 ? ' is-selected' : ''}" data-detail-image="${escapeHtml(image)}" aria-label="Show image ${index + 1} of ${images.length}"><img src="${escapeHtml(image)}" alt=""></button>`).join('')}</div>`;
  }

  function shippingLines(item) {
    const shipping = item.shipping || item.raw?.shippingOptions?.[0] || {};
    const lines = [];
    const cost = shipping.cost || (shipping.shippingCost?.value != null ? `${shipping.shippingCost.currency || 'USD'} ${shipping.shippingCost.value}` : '');
    const service = shipping.type || shipping.shippingServiceType || shipping.optionType;
    const handling = item.raw?.handlingTime || item.raw?.handlingTimeDays || item.raw?.shippingOptions?.[0]?.handlingTime;
    if (service) lines.push(service);
    if (cost) lines.push(`Shipping: ${cost}`);
    if (handling) lines.push(`Handling: ${handling}${typeof handling === 'number' ? ' business day' + (handling === 1 ? '' : 's') : ''}`);
    if (lines.length) lines.push('Shipping is calculated through eBay.');
    return lines;
  }

  function renderProductDetails(item) {
    const images = detailImages(item);
    const sourceDescription = item.description || item.shortDescription || item.raw?.description || item.raw?.shortDescription || item.raw?.itemDescription;
    const descriptionText = listingDescription(sourceDescription);
    const conditionDetails = cleanText(item.conditionDescription || item.raw?.conditionDescription) || buyerText(sourceDescription).split(/\n{2,}/).filter(paragraph => /\b(condition|wear|tear|hole|stain|chip|crack|scratch|scuff|flaw|damage)\b/i.test(paragraph)).join(' ');
    const rows = mergeRows(detailRows(item), descriptionRows(sourceDescription));
    const measurements = measurementRows(rows);
    const details = curatedRows(rows);
    const quick = quickRows(item, [...details, ...measurements]);
    const shipping = shippingLines(item);
    const cta = `<a class="product-cta product-ebay-cta product-details-ebay" data-ga4-outbound="ebay" href="${escapeHtml(item.url || storeUrl)}" target="_blank" rel="noopener noreferrer"><span class="ebay-wordmark" aria-hidden="true"><span>e</span><span>b</span><span>a</span><span>y</span></span><span>View on eBay</span></a>`;
    productDetailsContent.innerHTML = `
      <div class="product-details-layout">
        <div class="product-details-gallery">${galleryMarkup(images, item.title || 'JoMagicBackpack item')}</div>
        <div class="product-details-copy">
          <p class="product-details-category">${escapeHtml(categories.find(entry => entry.key === assignedCategoryKey(item))?.label || 'Other Finds')}</p>
          <h2 id="productDetailsTitle">${escapeHtml(item.title || 'JoMagicBackpack item')}</h2>
          ${item.price ? `<p class="product-details-price">${escapeHtml(item.price)}</p>` : ''}
          ${quick.length ? `<section><h3>Quick details</h3><ul class="product-quick-details">${quick.map(([name, value]) => `<li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(value)}</li>`).join('')}</ul></section>` : ''}
          ${descriptionText ? `<section><h3>About this find</h3><p>${escapeHtml(descriptionText)}</p></section>` : ''}
          ${item.condition && item.condition !== 'â€”' ? `<section><h3>Condition</h3><p class="product-details-condition"><strong>${escapeHtml(item.condition)}</strong>${conditionDetails && conditionDetails !== item.condition ? `<br>${escapeHtml(conditionDetails)}` : ''}</p></section>` : ''}
          ${details.length ? `<section><h3>Details</h3><dl class="product-details-list">${details.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>` : ''}
          ${measurements.length ? `<section><h3>Measurements</h3><dl class="product-details-list product-measurements">${measurements.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>` : ''}
          ${shipping.length ? `<section><h3>Shipping</h3><p>${shipping.map(escapeHtml).join('<br>')}</p></section>` : ''}
          <section class="product-details-purchase"><h3>Ready to make it yours?</h3>${cta}</section>
        </div>
      </div>`;
  }

  async function openProductDetails(item) {
    if (!productDetailsDialog || !productDetailsContent) return;
    productDetailsContent.innerHTML = '<div class="product-detail-loading">Gathering the details from the backpack...</div>';
    productDetailsDialog.showModal();
    renderProductDetails(await hydrateItemDetails(item));
  }

  function renderItems() {
    if (!productsGrid) return;
    const items = visibleItems();
    const visible = items.slice(0, visibleItemCount);
    const remainingCount = Math.max(items.length - visible.length, 0);

    if (resultSummary) {
      const label = activeCategory ? activeCategory.label : 'items';
      resultSummary.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'} showing in ${label}.`;
    }

    if (!items.length) {
      setStatus('No matching items found here. Try a different search or open the full eBay store.');
      return;
    }

    productsGrid.innerHTML = visible.map(productCardMarkup).join('') + (
      remainingCount > 0
        ? `<div class="load-more-wrap"><button id="loadMoreItems" class="load-more-button" type="button">Load more items (${remainingCount} left)</button></div>`
        : ''
    );
  }

  async function loadCategory(category, options = {}) {
    if (options.updateHistory) setCategoryHistory(category);
    showProductPanel(category);
    setStatus('Pulling full store inventory...');

    try {
      const inventory = await fetchStoreInventory();
      activeItems = inventory.filter(item => belongsInCategory(item, category));
      visibleItemCount = initialVisibleCount;
      renderItems();
    } catch (error) {
      console.error(error);
      setStatus('The inventory did not load. Use the eBay link to open the store directly.');
    }
  }

  if (categoryShowcase) {
    const pointToCard = card => {
      const angle = Number(card?.dataset.angle);
      if (!Number.isFinite(angle)) {
        categoryShowcase.classList.remove('has-active-category');
        return;
      }
      categoryShowcase.style.setProperty('--beam-angle', `${angle}deg`);
      categoryShowcase.classList.add('has-active-category');
    };

    const clearPointer = event => {
      if (event?.relatedTarget && categoryShowcase.contains(event.relatedTarget)) return;
      categoryShowcase.classList.remove('has-active-category');
    };

    categoryShowcase.addEventListener('pointerover', event => {
      const card = event.target.closest('.category-card');
      if (card) {
        pointToCard(card);
      } else {
        categoryShowcase.classList.remove('has-active-category');
      }
    });

    categoryShowcase.addEventListener('pointerout', clearPointer);

    categoryShowcase.addEventListener('focusin', event => {
      const card = event.target.closest('.category-card');
      if (card) {
        pointToCard(card);
      } else {
        categoryShowcase.classList.remove('has-active-category');
      }
    });

    categoryShowcase.addEventListener('focusout', clearPointer);

    categoryShowcase.addEventListener('click', event => {
      const card = event.target.closest('[data-category]');
      if (!card || categoryOpening) return;
      const category = categories.find(item => item.key === card.dataset.category);
      if (!category) return;

      categoryOpening = true;
      card.classList.add('is-selected');
      categoryShowcase.classList.add('is-opening');
      window.setTimeout(() => {
        categoryShowcase.classList.remove('is-opening');
        card.classList.remove('is-selected');
        categoryOpening = false;
        loadCategory(category, { updateHistory: true });
      }, 740);
    });
  }

  if (productsGrid) {
    productsGrid.addEventListener('click', event => {
      if (event.target.closest('.product-cta')) return;
      const card = event.target.closest('.product-card');
      if (card) {
        const item = activeItems.find(candidate => String(candidate.id) === String(card.dataset.itemId));
        if (item) openProductDetails(item);
        return;
      }
      const loadMoreButton = event.target.closest('#loadMoreItems');
      if (!loadMoreButton) return;
      visibleItemCount += loadMoreStep;
      renderItems();
    });
  }

  if (productsGrid) {
    productsGrid.addEventListener('keydown', event => {
      if (event.target.closest('.product-cta')) return;
      const card = event.target.closest('.product-card');
      if (!card || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      const item = activeItems.find(candidate => String(candidate.id) === String(card.dataset.itemId));
      if (item) openProductDetails(item);
    });
  }

  if (inventorySearch) {
    inventorySearch.addEventListener('input', () => {
      visibleItemCount = initialVisibleCount;
      renderItems();
    });
  }

  if (inventorySort) {
    inventorySort.addEventListener('change', () => {
      visibleItemCount = initialVisibleCount;
      renderItems();
    });
  }

  if (closeProductDetails && productDetailsDialog) {
    closeProductDetails.addEventListener('click', () => productDetailsDialog.close());
    productDetailsDialog.addEventListener('click', event => { if (event.target === productDetailsDialog) productDetailsDialog.close(); });
    productDetailsContent.addEventListener('click', event => {
      const thumbnail = event.target.closest('.product-detail-thumbnail');
      if (!thumbnail) return;
      const selected = productDetailsContent.querySelector('[data-detail-selected-image]');
      if (selected) selected.src = thumbnail.dataset.detailImage;
      productDetailsContent.querySelectorAll('.product-detail-thumbnail').forEach(button => button.classList.toggle('is-selected', button === thumbnail));
    });
  }

  if (backToCategories) {
    backToCategories.addEventListener('click', showCategoryPanelFromButton);
  }

  const openBackpack = document.getElementById('openBackpack');
  const backpackGate = document.getElementById('backpackGate');

  if (openBackpack && backpackGate) {
    openBackpack.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      backpackGate.classList.add('is-opening');
      window.setTimeout(() => {
        window.location.href = openBackpack.href;
      }, 720);
    });
  }

  if (categoryShowcase) {
    renderCategories();
    const initialCategory = categoryFromHash();
    setCategoryHistory(initialCategory, 'replace');
    if (initialCategory) loadCategory(initialCategory);
    window.addEventListener('popstate', event => {
      const category = categoryFromKey(event.state?.categoryKey) || categoryFromHash();
      if (category) {
        loadCategory(category);
      } else {
        showCategoryPanel();
      }
    });
    fetchStoreInventory().then(renderCategories).catch(() => {});
  }
});

