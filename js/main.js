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
      label: 'Newly Listed',
      emblem: '✦',
      heading: 'Newly Listed',
      description: 'Discover the most recently listed items.',
      mood: 'Discover the most recently listed items.',
      queries: [''],
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      emblem: '◫',
      heading: 'Clothing',
      description: 'Stylish threads from outside the algorithm.',
      mood: 'Stylish threads from outside the algorithm.',
      queries: ['shirt', 'jacket', 'sweater', 'pants'],
      include: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'coat', 'hoodie', 'dress'],
      exclude: ['doll', 'toy'],
      viewQuery: 'shirt jacket sweater pants'
    },
    {
      key: 'footwear',
      label: 'Footwear',
      emblem: '⌁',
      heading: 'Footwear',
      description: 'Footwear for every kind of wandering.',
      mood: 'Footwear for every kind of wandering.',
      queries: ['shoes', 'boots', 'sneakers', 'sandals'],
      include: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sandals'],
      exclude: ['figurine', 'toy'],
      viewQuery: 'shoes boots sneakers sandals'
    },
    {
      key: 'kitchen',
      label: 'Kitchen & Dining',
      emblem: '◌',
      heading: 'Kitchen & Dining',
      description: 'Kitchenware, tableware, and culinary curiosities.',
      mood: 'Kitchenware, tableware, and culinary curiosities.',
      queries: ['plate', 'bowl', 'mug', 'glass'],
      include: ['plate', 'bowl', 'mug', 'glass', 'dish', 'tray', 'kitchen', 'cookware'],
      exclude: ['shirt', 'shoe'],
      viewQuery: 'plate bowl mug kitchen'
    },
    {
      key: 'decor',
      label: 'Decor & Atmosphere',
      emblem: '✧',
      heading: 'Decor & Atmosphere',
      description: 'Objects chosen for mood and presence.',
      mood: 'Objects chosen for mood and presence.',
      queries: ['decor', 'art', 'lamp', 'vase'],
      include: ['decor', 'art', 'lamp', 'vase', 'frame', 'painting', 'wall', 'candle'],
      exclude: [],
      viewQuery: 'decor art lamp vase'
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      emblem: '◇',
      heading: 'Collectibles',
      description: 'Media, relics, oddities, and hidden gems.',
      mood: 'Media, relics, oddities, and hidden gems.',
      queries: ['collectible', 'vintage', 'toy', 'book', 'media'],
      include: ['collectible', 'vintage', 'media', 'toy', 'book', 'pokemon', 'dvd', 'game', 'figurine'],
      exclude: [],
      viewQuery: 'collectible vintage media'
    },
    {
      key: 'accessories',
      label: 'Accessories',
      emblem: '◎',
      heading: 'Accessories',
      description: 'The smaller details that complete the picture.',
      mood: 'The smaller details that complete the picture.',
      queries: ['bag', 'wallet', 'hat', 'belt'],
      include: ['bag', 'wallet', 'hat', 'belt', 'jewelry', 'necklace', 'bracelet', 'earrings'],
      exclude: [],
      viewQuery: 'bag wallet hat jewelry'
    },
    {
      key: 'sidepocket',
      label: 'The Side Pocket',
      emblem: '✺',
      heading: 'The Side Pocket',
      description: 'Strange finds and category-resistant objects.',
      mood: 'Strange finds and category-resistant objects.',
      queries: ['odd', 'strange', 'unusual'],
      include: [],
      exclude: [],
      viewQuery: 'odd unusual strange'
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

    if (category.key === 'sidepocket') {
      return !hasAny(text, [
        'shirt','pants','shoe','boot','plate','mug','wallet','hat','collectible'
      ]);
    }

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
      const aTime = Date.parse(a.startTime || '') || 0;
      const bTime = Date.parse(b.startTime || '') || 0;
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
      viewAllLink.href = category.key === 'latest'
        ? storeUrl
        : ebaySearchUrl(category.viewQuery || category.queries[0] || '');

      viewAllLink.textContent = category.key === 'latest'
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

    if (productsGrid) productsGrid.innerHTML = '';
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
  }

  async function fetchItemsForCategory(category) {
    const responses = await Promise.allSettled(
      category.queries.map(query =>
        fetch(functionUrl(query)).then(response => response.json())
      )
    );

    const combined = responses.flatMap(result => {
      if (result.status !== 'fulfilled') return [];

      const data = result.value;

      if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
        return [];
      }

      return data.result.items;
    });

    return sortNewestFirst(
      uniqueItems(combined).filter(item => belongsInCategory(item, category))
    ).slice(0, 24);
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