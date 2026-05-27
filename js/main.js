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

  const categories = [
    {
      key: 'latest',
      label: 'Newest Finds',
      emblem: '✦',
      heading: 'Newest Finds',
      description: 'The freshest active listings currently in the backpack.',
      mood: 'Newly added pieces from across the shop.',
      queries: [''],
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      emblem: '♧',
      heading: 'Clothing',
      description: 'Shirts, jackets, sweaters, pants, and other wearable finds.',
      mood: 'Wearable finds with history still stitched into them.',
      queries: ['shirt', 'jacket', 'sweater', 'pants'],
      include: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'shorts', 'coat', 'vest', 'flannel', 'hoodie', 'dress', 'skirt', 'blouse', 'top'],
      exclude: ['doll', 'toy', 'figure', 'figurine', 'wall', 'decor', 'ornament', 'plate', 'mug', 'book', 'poster', 'print', 'art'],
      viewQuery: 'shirt jacket sweater pants'
    },
    {
      key: 'home',
      label: 'Home & Housewares',
      emblem: '⌂',
      heading: 'Home & Housewares',
      description: 'Dishes, glassware, decor, kitchen pieces, and useful home finds.',
      mood: 'Objects that survived kitchens, shelves, garages, and decades.',
      queries: ['plate', 'bowl', 'mug', 'vase', 'glass', 'decor'],
      include: ['plate', 'bowl', 'mug', 'cup', 'vase', 'glass', 'ceramic', 'porcelain', 'kitchen', 'decor', 'wall', 'plaque', 'frame', 'figurine', 'figure', 'statue', 'candle', 'dish', 'tray', 'canister'],
      exclude: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'sneaker', 'sneakers', 'boot', 'boots', 'sandals', 'purse', 'wallet'],
      viewQuery: 'plate bowl mug vase glass decor'
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      emblem: '◇',
      heading: 'Collectibles',
      description: 'Books, toys, media, art, vintage pieces, and category-resistant treasures.',
      mood: 'Strange little artifacts waiting for the right person.',
      queries: ['vintage', 'collectible', 'toy', 'book', 'art', 'Pokemon'],
      include: ['vintage', 'collectible', 'toy', 'figure', 'figurine', 'book', 'media', 'art', 'pokemon', 'disney', 'dvd', 'cd', 'vhs', 'game', 'poster', 'print', 'ornament', 'miniature'],
      exclude: [],
      viewQuery: 'vintage collectible toy book art'
    },
    {
      key: 'bags',
      label: 'Bags & Accessories',
      emblem: '◌',
      heading: 'Bags & Accessories',
      description: 'Bags, wallets, hats, belts, scarves, jewelry, and smaller wearable accessories.',
      mood: 'Pocket-sized curiosities and everyday carry relics.',
      queries: ['bag', 'purse', 'wallet', 'backpack', 'hat'],
      include: ['bag', 'purse', 'wallet', 'backpack', 'tote', 'clutch', 'satchel', 'hat', 'cap', 'belt', 'scarf', 'jewelry', 'necklace', 'bracelet', 'earrings', 'brooch', 'pin'],
      exclude: ['wall', 'decor', 'plate', 'mug', 'bowl', 'vase', 'book', 'toy', 'figure', 'figurine', 'poster', 'print'],
      viewQuery: 'bag purse wallet hat'
    },
    {
      key: 'shoes',
      label: 'Shoes',
      emblem: '⌁',
      heading: 'Shoes',
      description: 'Wearable shoes, boots, sneakers, sandals, and other footwear.',
      mood: 'Footwear with a little road still left in it.',
      queries: ['shoes', 'boots', 'sneakers', 'sandals'],
      include: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'sandal', 'sandals', 'loafer', 'loafers', 'heel', 'heels', 'cleat', 'cleats', 'slipper', 'slippers', 'footwear'],
      exclude: ['figurine', 'figure', 'mini', 'miniature', 'tiny', 'doll', 'toy', 'wall', 'decor', 'decoration', 'ornament', 'charm', 'pin', 'brooch', 'pendant', 'plaque', 'sign', 'art', 'print', 'poster', 'picture', 'painting', 'ceramic', 'porcelain', 'resin', 'glass', 'bookend', 'ashtray'],
      viewQuery: 'shoes boots sneakers sandals'
    }
  ];

  function ebaySearchUrl(query) {
    const url = new URL('https://www.ebay.com/sch/i.html');
    url.searchParams.set('_ssn', seller);
    if (query) url.searchParams.set('_nkw', query);
    url.searchParams.set('_sop', '10');
    return url.toString();
  }

  function functionUrl(query, limit = 18) {
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('seller', seller);
    url.searchParams.set('q', query || 'a');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('sort', 'StartTimeNewest');
    return url.toString();
  }

  function textForItem(item) {
    return [item.title, item.condition, item.seller].filter(Boolean).join(' ').toLowerCase();
  }

  function hasAny(text, words = []) {
    return words.some(word => text.includes(word.toLowerCase()));
  }

  function belongsInCategory(item, category) {
    if (!category || category.key === 'latest') return true;
    const text = textForItem(item);
    return hasAny(text, category.include || []) && !hasAny(text, category.exclude || []);
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
      const aTime = Date.parse(a.startTime || a.listingStartTime || a.date || '') || 0;
      const bTime = Date.parse(b.startTime || b.listingStartTime || b.date || '') || 0;
      return bTime - aTime;
    });
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
      viewAllLink.href = category.key === 'latest' ? storeUrl : ebaySearchUrl(category.viewQuery || category.queries[0] || '');
      viewAllLink.textContent = category.key === 'latest' ? 'View all items on eBay' : `View all ${category.label} on eBay`;
    }
  }

  function showCategoryPanel() {
    if (!categoryIntro || !categoryShowcase || !productPanel) return;
    productPanel.hidden = true;
    productPanel.classList.remove('is-visible');
    categoryIntro.hidden = false;
    categoryShowcase.hidden = false;
    if (productsGrid) productsGrid.innerHTML = '';
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
  }

  async function fetchItemsForCategory(category) {
    const responses = await Promise.allSettled(
      category.queries.map(query => fetch(functionUrl(query)).then(response => response.json()))
    );

    const combined = responses.flatMap(result => {
      if (result.status !== 'fulfilled') return [];
      const data = result.value;
      if (!data.ok || !data.result || !Array.isArray(data.result.items)) return [];
      return data.result.items;
    });

    return sortNewestFirst(uniqueItems(combined).filter(item => belongsInCategory(item, category))).slice(0, 24);
  }

  function renderItems(items) {
    if (!productsGrid) return;
    if (!items.length) {
      setStatus('No matching items loaded here. Use the view-all link to open the full eBay results.');
      return;
    }

    productsGrid.innerHTML = items.map(item => `
      <article class="product-card">
        <a class="product-image" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${item.image || 'https://via.placeholder.com/300x220?text=JoMagicBackpack'}" alt="${item.title || 'JoMagicBackpack item'}">
        </a>
        <h3>${item.title || 'JoMagicBackpack item'}</h3>
        ${item.price ? `<p class="price">${item.price}</p>` : ''}
      </article>
    `).join('');
  }

  async function loadCategory(category) {
    showProductPanel(category);
    setStatus(`Loading ${category.label.toLowerCase()}…`);
    try {
      const items = await fetchItemsForCategory(category);
      renderItems(items);
    } catch (error) {
      console.error(error);
      setStatus('The live eBay feed did not load. Use the view-all link to open the store directly.');
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

  if (backToCategories) {
    backToCategories.addEventListener('click', showCategoryPanel);
  }

  renderCategories();
});