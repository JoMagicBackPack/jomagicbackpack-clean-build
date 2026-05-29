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

  const seller = 'jomagicbackpack';
  const storeUrl = `https://www.ebay.com/str/${seller}`;
  const initialVisibleCount = 24;
  const loadMoreStep = 24;

  let storeInventory = null;
  let inventoryFetchPromise = null;
  let activeCategory = null;
  let activeItems = [];
  let visibleItemCount = initialVisibleCount;
  let categoryOpening = false;

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
      label: 'Bags & Accessories',
      heading: 'Bags & Accessories',
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

    if (hasAny(category, ['athletic shoes', 'dress shoes', 'comfort shoes', 'boots', 'flats', "kids' shoes", 'sandals', 'casual shoes', 'heels', 'slippers'])) return 'footwear';
    if (hasAny(category, ['bags', 'handbags', 'cases', 'hats', 'necklaces', 'pendants', 'cufflinks', 'badges', 'pins', 'buttons', 'jewelry', 'watches', 'belts', 'gloves', 'scarves', 'wraps', 'hair extensions'])) return 'accessories';
    if (hasAny(category, ['activewear tops', 'casual shirts', 'button-down shirts', 't-shirts', 'sweaters', 'pants', 'jeans', 'coats', 'jackets', 'vests', 'suits', 'hoodies', 'sweatshirts', 'apparel', 'tops', 'polos', 'socks', 'shorts', 'jerseys', 'show shirts'])) return 'clothing';
    if (hasAny(category, ['cross stitch', 'embroidery', 'needlepoint', 'craft books', 'crafts']) || /\b(cross stitch|embroidery|needlepoint|craft kit|ornament kit|activity books)\b/.test(title)) return 'crafts';
    if (hasAny(category, ['books', 'antiquarian', 'manuals', 'postcards']) && hasAny(allText, ['book', 'books', 'manual', 'postcard', 'paper'])) return 'books';
    if (hasAny(category, ['plates', 'bowls', 'mugs', 'drinkware', 'glassware', 'shot glasses', 'dishes', 'teapots', 'gravy boats', 'casseroles', 'cup & saucers', 'canisters', 'jars', 'cutting boards', 'trays', 'colanders', 'strainers', 'pitchers', 'cream & sugar', 'creamers', 'napkin rings', 'kitchen tools', 'pottery & glass', 'trivets', 'coasters', 'salt & pepper shakers', 'ice buckets', 'cookie cutters', 'ice cream'])) return 'kitchen';
    if (hasAny(category, ['afghans', 'throw blankets', 'plaques', 'signs', 'suncatchers', 'mobiles', 'boxes', 'tins', 'ashtrays', 'tapestries', 'wood items', 'lights', 'decor', 'decorative', 'vases', 'wall', 'pillows', 'villages', 'houses', 'bells', 'lamp shades', 'quilts', 'mirrors', 'copper'])) return 'home';
    if (hasAny(category, ['bears', 'action figures', 'model horses', 'dumbo', 'animation', 'harry potter', 'party decorations', 'toys', 'ccg mixed card lots', 'vehicles']) || /\b(pokemon|disney|harry potter|gi joe|breyer|doll|plush|star wars)\b/.test(title)) return 'toys';
    if (hasAny(category, ['sculptures', 'figurines', 'paperweights', 'football-nfl', 'baseball-mlb', 'memorabilia', 'vintage', 'collectibles', 'decorative collectibles', 'indian', 'wedding supplies', 'binoculars', '1970s', 'canada', 'latin am', 'holiday collectibles', 'animals & nature', 'statues', 'figures', 'movie cameras', 'elves', 'gnomes', 'pixies'])) return 'collectibles';

    return 'other';
  }

  function belongsInCategory(item, category) {
    if (!category) return false;
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
    return Date.parse(item.startTime || item.itemCreationDate || item.raw?.itemCreationDate || item.raw?.itemOriginDate || '') || 0;
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
        storeInventory = sortNewestFirst(liveItems);
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
      viewAllLink.href = category.key === 'all' ? storeUrl : ebaySearchUrl(category.viewQuery || '');
      viewAllLink.textContent = category.key === 'all' ? 'View all items on eBay' : `View all ${category.label} on eBay`;
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

    return `
      <article class="product-card">
        <a class="product-image" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer">
          ${imageMarkup}
        </a>
        <div class="product-meta">${category ? category.label : 'Other Finds'}</div>
        <h3>${item.title || 'JoMagicBackpack item'}</h3>
        ${item.price ? `<p class="price">${item.price}</p>` : ''}
        <a class="product-cta" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer">View on eBay</a>
      </article>
    `;
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

  async function loadCategory(category) {
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
        loadCategory(category);
      }, 740);
    });
  }

  if (productsGrid) {
    productsGrid.addEventListener('click', event => {
      const loadMoreButton = event.target.closest('#loadMoreItems');
      if (!loadMoreButton) return;
      visibleItemCount += loadMoreStep;
      renderItems();
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

  if (backToCategories) {
    backToCategories.addEventListener('click', showCategoryPanel);
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
    fetchStoreInventory().then(renderCategories).catch(() => {});
  }
});
