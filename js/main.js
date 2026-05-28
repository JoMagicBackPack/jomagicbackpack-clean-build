document.addEventListener('DOMContentLoaded', () => {
  const backpackGate = document.getElementById('backpackGate');
  const openBackpack = document.getElementById('openBackpack');
  const shopInterface = document.getElementById('shopInterface');
  const categoryIntro = document.getElementById('categoryIntro');
  const categoryShowcase = document.getElementById('categoryShowcase');
  const productPanel = document.getElementById('productPanel');
  const backToCategories = document.getElementById('backToCategories');
  const productsGrid = document.getElementById('productsGrid');
  const heading = document.getElementById('products-heading');
  const description = document.getElementById('products-description');
  const viewAllLink = document.getElementById('viewAllCategory');

  const seller = 'jomagicbackpack';
  const storeUrl = `https://www.ebay.com/str/${seller}`;
  const initialVisibleCount = 24;
  const loadMoreStep = 24;
  const inventoryPageLimit = 50;
  const inventoryPages = 6;
  const recentListingDays = 30;

  let storeInventory = null;
  let inventoryFetchPromise = null;
  let activeItems = [];
  let visibleItemCount = initialVisibleCount;

  const categories = [
    {
      key: 'all',
      label: 'All Items',
      emblem: '✦',
      heading: 'All Items',
      description: 'Every active listing currently loaded from the backpack.',
      mood: 'Everything currently in the backpack.',
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      emblem: '◫',
      heading: 'Clothing',
      description: 'Stylish threads from outside the algorithm.',
      mood: 'Stylish threads from outside the algorithm.',
      include: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'coat', 'hoodie', 'dress', 'flannel', 'pullover', 'shorts', 'top', 'vest', 't-shirt', 'suit', 'activewear'],
      exclude: ['doll', 'toy', 'plate', 'mug', 'bowl', 'figurine'],
      viewQuery: 'shirt jacket sweater pants'
    },
    {
      key: 'footwear',
      label: 'Footwear',
      emblem: '⌁',
      heading: 'Footwear',
      description: 'Footwear for every kind of wandering.',
      mood: 'Footwear for every kind of wandering.',
      include: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'sandals', 'loafer', 'loafers', 'heels'],
      exclude: ['figurine', 'toy', 'plate'],
      viewQuery: 'shoes boots sneakers sandals'
    },
    {
      key: 'kitchen',
      label: 'Kitchen & Dining',
      emblem: '◌',
      heading: 'Kitchen & Dining',
      description: 'Kitchenware, tableware, and culinary curiosities.',
      mood: 'Kitchenware, tableware, and culinary curiosities.',
      include: ['plate', 'plates', 'bowl', 'bowls', 'mug', 'glass', 'dish', 'tray', 'kitchen', 'cookware', 'cup', 'saucer', 'canister', 'pitcher', 'limoges', 'sasaki', 'vase', 'drinkware', 'pottery', 'porcelain', 'ceramic'],
      exclude: ['shirt', 'shoe', 'wallet'],
      viewQuery: 'plate bowl mug kitchen cookware'
    },
    {
      key: 'accessories',
      label: 'Accessories',
      emblem: '◎',
      heading: 'Accessories',
      description: 'The smaller details that complete the picture.',
      mood: 'The smaller details that complete the picture.',
      include: ['bag', 'wallet', 'hat', 'belt', 'jewelry', 'necklace', 'bracelet', 'earrings', 'purse', 'clutch', 'watch', 'scarf'],
      exclude: ['plate', 'bowl', 'mug'],
      viewQuery: 'bag wallet hat jewelry accessories'
    },
    {
      key: 'curiosities',
      label: 'Curiosities',
      emblem: '✺',
      heading: 'Curiosities',
      description: 'Relics, oddities, atmosphere, and things that resist categories.',
      mood: 'Relics, oddities, atmosphere, and things that resist categories.',
      exclude: ['shirt', 'pants', 'jeans', 'shoe', 'boot', 'sneaker', 'plate', 'bowl', 'mug', 'wallet', 'hat', 'belt'],
      viewQuery: 'vintage collectible art decor oddities'
    }
  ];

  categories.splice(0, categories.length,
    {
      key: 'all',
      label: 'All Items',
      emblem: 'ALL',
      heading: 'All Items',
      description: 'Every active listing currently loaded from the backpack.',
      mood: 'Everything currently in the backpack.',
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      emblem: 'CLO',
      heading: 'Clothing',
      description: 'Shirts, sweaters, jackets, pants, jeans, suits, and apparel.',
      mood: 'Wearable finds from the backpack.',
      viewQuery: 'shirt jacket sweater pants'
    },
    {
      key: 'footwear',
      label: 'Shoes',
      emblem: 'SHO',
      heading: 'Shoes',
      description: 'Shoes, boots, flats, sneakers, and sandals.',
      mood: 'Footwear for every kind of wandering.',
      viewQuery: 'shoes boots sneakers sandals'
    },
    {
      key: 'accessories',
      label: 'Bags & Accessories',
      emblem: 'BAG',
      heading: 'Bags & Accessories',
      description: 'Bags, hats, jewelry, pins, watches, belts, and smaller wearable details.',
      mood: 'The smaller details that complete the picture.',
      viewQuery: 'bag wallet hat jewelry accessories'
    },
    {
      key: 'kitchen',
      label: 'Kitchen & Dining',
      emblem: 'DIN',
      heading: 'Kitchen & Dining',
      description: 'Plates, bowls, mugs, glassware, serving pieces, and kitchen tools.',
      mood: 'Kitchenware, tableware, and culinary curiosities.',
      viewQuery: 'plate bowl mug kitchen cookware'
    },
    {
      key: 'home',
      label: 'Home Decor',
      emblem: 'HOM',
      heading: 'Home Decor',
      description: 'Blankets, wall decor, vases, lights, tapestries, boxes, and display pieces.',
      mood: 'Pieces that make a room feel found, not furnished.',
      viewQuery: 'home decor blanket vase wall art'
    },
    {
      key: 'toys',
      label: 'Toys & Character',
      emblem: 'TOY',
      heading: 'Toys & Character',
      description: 'Bears, action figures, dolls, Disney, Harry Potter, animation, and playful finds.',
      mood: 'Nostalgia, characters, and playful shelf treasures.',
      viewQuery: 'toy bear doll disney pokemon'
    },
    {
      key: 'crafts',
      label: 'Crafts',
      emblem: 'ART',
      heading: 'Crafts',
      description: 'Cross stitch, embroidery kits, craft books, and handmade project supplies.',
      mood: 'Kits, stitches, patterns, and hands-on finds.',
      viewQuery: 'cross stitch embroidery craft kit'
    },
    {
      key: 'books',
      label: 'Books & Paper',
      emblem: 'BK',
      heading: 'Books & Paper',
      description: 'Books, collectible paper, ephemera, and printed pieces.',
      mood: 'Printed finds with a little history in them.',
      viewQuery: 'book vintage paper collectible'
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      emblem: 'COL',
      heading: 'Collectibles',
      description: 'Figurines, sculptures, sports, vintage display pieces, and category-resistant treasures.',
      mood: 'Relics, oddities, atmosphere, and display-worthy finds.',
      viewQuery: 'vintage collectible art decor oddities'
    },
    {
      key: 'other',
      label: 'Other Finds',
      emblem: 'OTH',
      heading: 'Other Finds',
      description: 'Items that do not neatly belong in the other backpack pockets.',
      mood: 'The pleasantly hard-to-file discoveries.',
      viewQuery: ''
    }
  );

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
    url.searchParams.set('limit', String(inventoryPageLimit));
    url.searchParams.set('pages', String(inventoryPages));
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
      raw: record,
    };
  }

  function textForItem(item) {
    const categoryText = Array.isArray(item.categories)
      ? item.categories.map(category => `${category.categoryName || ''} ${category.categoryId || ''}`).join(' ')
      : '';

    return [item.title, item.condition, item.seller, categoryText].filter(Boolean).join(' ').toLowerCase();
  }

  function ebayCategoryText(item) {
    return Array.isArray(item.categories)
      ? item.categories.map(category => category.categoryName || '').join(' ').toLowerCase()
      : '';
  }

  function itemTitleText(item) {
    return (item.title || '').toLowerCase();
  }

  function hasAny(text, words = []) {
    return words.some(word => text.includes(word.toLowerCase()));
  }

  function assignedCategoryKey(item) {
    const categoryText = ebayCategoryText(item);
    const titleText = itemTitleText(item);
    const text = `${categoryText} ${titleText}`;

    if (hasAny(categoryText, ['athletic shoes', 'dress shoes', 'comfort shoes', 'boots', 'flats', "kids' shoes", 'sandals'])) {
      return 'footwear';
    }

    if (hasAny(categoryText, ['bags', 'handbags', 'cases', 'hats', 'necklaces', 'pendants', 'cufflinks', 'badges', 'pins', 'buttons', 'jewelry', 'watches'])) {
      return 'accessories';
    }

    if (hasAny(categoryText, ['activewear tops', 'casual shirts', 'button-down shirts', 't-shirts', 'sweaters', 'pants', 'jeans', 'coats', 'jackets', 'vests', 'suits', 'hoodies', 'sweatshirts', 'apparel', 'tops'])) {
      return 'clothing';
    }

    if (hasAny(categoryText, ['cross stitch', 'embroidery', 'needlepoint', 'craft books', 'crafts']) ||
        /\b(cross stitch|embroidery|needlepoint|craft kit|ornament kit|activity books)\b/.test(titleText)) {
      return 'crafts';
    }

    if (hasAny(categoryText, ['books', 'antiquarian', 'collectible']) && hasAny(text, ['book', 'books', 'isbn', 'paper'])) {
      return 'books';
    }

    if (hasAny(categoryText, ['plates', 'bowls', 'mugs', 'drinkware', 'glassware', 'cup & saucers', 'canisters', 'jars', 'cutting boards', 'trays', 'colanders', 'strainers', 'pitchers', 'cream & sugar', 'creamers', 'napkin rings', 'kitchen tools', 'pottery & glass', 'trivets', 'coasters', 'salt & pepper shakers'])) {
      return 'kitchen';
    }

    if (hasAny(categoryText, ['afghans', 'throw blankets', 'plaques', 'signs', 'suncatchers', 'mobiles', 'boxes', 'tins', 'ashtrays', 'tapestries', 'wood items', 'lights', 'decor', 'décor', 'vases', 'wall', 'pillows', 'villages', 'houses', 'bells'])) {
      return 'home';
    }

    if (hasAny(categoryText, ['bears', 'action figures', 'model horses', 'dumbo', 'animation', 'harry potter', 'party decorations', 'toys', 'ccg mixed card lots']) ||
        /\b(pokemon|disney|harry potter|gi joe|breyer|doll|plush)\b/.test(titleText)) {
      return 'toys';
    }

    if (hasAny(categoryText, ['sculptures', 'figurines', 'paperweights', 'football-nfl', 'baseball-mlb', 'memorabilia', 'vintage', 'decorative collectibles', 'indian', 'wedding supplies', 'binoculars', '1970s', 'canada'])) {
      return 'collectibles';
    }

    const allowTitleFallback = !categoryText || categoryText.startsWith('other ') || categoryText === 'other' || categoryText === 'vintage';
    if (allowTitleFallback) {
      if (/\b(shoes?|boots?|sneakers?|sandals?|loafers?|heels?)\b/.test(titleText)) return 'footwear';
      if (/\b(bag|handbag|purse|clutch|hat|belt|wallet|necklace|pendant|cufflinks?|pin|watch|scarf)\b/.test(titleText)) return 'accessories';
      if (/\b(shirt|sweater|jacket|coat|vest|pants|jeans|hoodie|sweatshirt|dress|shorts|skirt|blouse|tee|t-shirt|suit|flannel|pullover)\b/.test(titleText)) return 'clothing';
      if (/\b(plate|bowl|mug|cup|saucer|glass|goblet|dish|tray|pitcher|canister|jar|creamer|drinkware|cookware|kitchen)\b/.test(titleText)) return 'kitchen';
      if (/\b(blanket|afghan|pillow|vase|lamp|light|wall|plaque|sign|tapestry|decor|planter|basket|box|tin|ashtray|mobile|suncatcher)\b/.test(titleText)) return 'home';
      if (/\b(collectible|figurine|sculpture|statue|paperweight|memorabilia|vintage|vtg|nfl|mlb|tiki|jester)\b/.test(titleText)) return 'collectibles';
    }

    return 'other';
  }

  function isRecentListing(item, days = recentListingDays) {
    const start = Date.parse(item.startTime || item.itemCreationDate || '');
    if (!start) return false;

    const ageMs = Date.now() - start;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return ageDays <= days;
  }

  function belongsInCategory(item, category) {
    if (!category) return false;

    if (category.key === 'all') return true;

    return assignedCategoryKey(item) === category.key;
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

  function sortNewestFirst(items) {
    return [...items].sort((a, b) => {
      const aTime = Date.parse(a.startTime || itemCreationFallback(a)) || 0;
      const bTime = Date.parse(b.startTime || itemCreationFallback(b)) || 0;
      return bTime - aTime;
    });
  }

  function itemCreationFallback(item) {
    return item.itemCreationDate || item.raw?.itemCreationDate || item.raw?.itemOriginDate || '';
  }

  function prioritizeRecent(items) {
    const recent = items.filter(item => isRecentListing(item));
    const older = items.filter(item => !isRecentListing(item));
    return [...recent, ...older];
  }

  async function fetchStoreInventory() {
    if (storeInventory) return storeInventory;
    if (inventoryFetchPromise) return inventoryFetchPromise;

    inventoryFetchPromise = fetch(inventoryUrl())
      .then(response => response.json())
      .then(data => {
        if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
          throw new Error(data.error || 'Inventory feed did not return items.');
        }

        storeInventory = sortNewestFirst(uniqueItems(data.result.items));
        if (storeInventory.length < 100) {
          throw new Error('Live inventory feed returned too few items.');
        }
        return storeInventory;
      })
      .catch(() => fetch('data/inventory.json')
        .then(response => {
          if (!response.ok) throw new Error('JSON inventory did not load.');
          return response.json();
        })
        .then(data => {
          storeInventory = sortNewestFirst(uniqueItems(data.items || []));
          return storeInventory;
        })
        .catch(() => fetch('data/inventory.csv')
          .then(response => {
            if (!response.ok) throw new Error('CSV inventory did not load.');
            return response.text();
          })
          .then(text => {
            storeInventory = sortNewestFirst(uniqueItems(parseCsv(text)));
            return storeInventory;
          })))
      .finally(() => {
        inventoryFetchPromise = null;
      });

    return inventoryFetchPromise;
  }

  function getItemsForCategory(category, inventory) {
    const filtered = inventory.filter(item => belongsInCategory(item, category));

    if (category.key === 'all') {
      return prioritizeRecent(filtered);
    }

    return sortNewestFirst(filtered);
  }

  function renderCategories() {
    if (!categoryShowcase) return;

    categoryShowcase.innerHTML = categories.map(category => `
      <button class="category-card" type="button" data-category="${category.key}">
        <span class="category-emblem" aria-hidden="true">${category.emblem}</span>
        <span class="category-title">${category.label}</span>
        <span class="category-description">${category.mood}</span>
      </button>
    `).join('');
  }

  function showProductPanel(category) {
    if (!categoryIntro || !categoryShowcase || !productPanel) return;

    categoryIntro.hidden = true;
    categoryShowcase.hidden = true;
    productPanel.hidden = false;
    productPanel.classList.add('is-visible');

    if (heading) heading.textContent = category.heading;
    if (description) description.textContent = category.description;

    if (viewAllLink) {
      viewAllLink.href = category.key === 'all'
        ? storeUrl
        : ebaySearchUrl(category.viewQuery || '');

      viewAllLink.textContent = category.key === 'all'
        ? 'View all items on eBay'
        : `View all ${category.label} on eBay`;
    }
  }

  function showCategoryPanel() {
    if (!categoryIntro || !categoryShowcase || !productPanel) return;

    productPanel.hidden = true;
    productPanel.classList.remove('is-visible');
    categoryIntro.hidden = false;
    categoryShowcase.hidden = false;

    activeItems = [];
    visibleItemCount = initialVisibleCount;
    if (productsGrid) productsGrid.innerHTML = '';
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
  }

  function productCardMarkup(item) {
    const imageMarkup = item.image
      ? `<img loading="lazy" src="${item.image}" alt="${item.title || 'JoMagicBackpack item'}">`
      : `<span class="product-image-fallback">No image yet</span>`;

    return `
      <article class="product-card">
        <a class="product-image" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer">
          ${imageMarkup}
        </a>
        <h3>${item.title || 'JoMagicBackpack item'}</h3>
        ${item.price ? `<p class="price">${item.price}</p>` : ''}
      </article>
    `;
  }

  function renderItems(items = activeItems) {
    if (!productsGrid) return;

    if (!items.length) {
      setStatus('No matching items loaded here. Use the view-all link to open the full eBay results.');
      return;
    }

    const visibleItems = items.slice(0, visibleItemCount);
    const remainingCount = Math.max(items.length - visibleItems.length, 0);

    productsGrid.innerHTML = visibleItems.map(productCardMarkup).join('') + (
      remainingCount > 0
        ? `<div class="load-more-wrap"><button id="loadMoreItems" class="load-more-button" type="button">Load more items (${remainingCount} left)</button></div>`
        : ''
    );
  }

  async function loadCategory(category) {
    showProductPanel(category);
    setStatus('Pulling full store inventory…');

    try {
      const inventory = await fetchStoreInventory();
      activeItems = getItemsForCategory(category, inventory);
      visibleItemCount = initialVisibleCount;
      renderItems(activeItems);
    } catch (error) {
      console.error(error);
      setStatus('The live eBay inventory feed did not load. Use the view-all link to open the store directly.');
    }
  }

  if (openBackpack && backpackGate && shopInterface) {
    openBackpack.addEventListener('click', () => {
      backpackGate.classList.add('opened');
      shopInterface.classList.add('is-visible');
      shopInterface.setAttribute('aria-hidden', 'false');
      shopInterface.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (categoryShowcase) {
    categoryShowcase.addEventListener('click', event => {
      const card = event.target.closest('.category-card');
      if (!card) return;

      const category = categories.find(item => item.key === card.dataset.category);

      if (category) loadCategory(category);
    });
  }

  if (productsGrid) {
    productsGrid.addEventListener('click', event => {
      const loadMoreButton = event.target.closest('#loadMoreItems');
      if (!loadMoreButton) return;

      visibleItemCount += loadMoreStep;
      renderItems(activeItems);
    });
  }

  if (backToCategories) {
    backToCategories.addEventListener('click', showCategoryPanel);
  }

  renderCategories();
});
