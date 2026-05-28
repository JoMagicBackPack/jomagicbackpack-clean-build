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
      key: 'latest',
      label: 'Newly Listed',
      emblem: '✦',
      heading: 'Newly Listed',
      description: `Fresh finds from the last ${recentListingDays} days, with newer items prioritized first.`,
      mood: 'Fresh finds recently added to the backpack.',
      viewQuery: ''
    },
    {
      key: 'clothing',
      label: 'Clothing',
      emblem: '◫',
      heading: 'Clothing',
      description: 'Stylish threads from outside the algorithm.',
      mood: 'Stylish threads from outside the algorithm.',
      include: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'coat', 'hoodie', 'dress', 'flannel', 'pullover', 'shorts'],
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
      include: ['plate', 'plates', 'bowl', 'bowls', 'mug', 'glass', 'dish', 'tray', 'kitchen', 'cookware', 'cup', 'saucer', 'canister', 'pitcher', 'limoges', 'sasaki'],
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

  function textForItem(item) {
    const categoryText = Array.isArray(item.categories)
      ? item.categories.map(category => `${category.categoryName || ''} ${category.categoryId || ''}`).join(' ')
      : '';

    return [item.title, item.condition, item.seller, categoryText].filter(Boolean).join(' ').toLowerCase();
  }

  function hasAny(text, words = []) {
    return words.some(word => text.includes(word.toLowerCase()));
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

    if (category.key === 'latest') return true;

    const text = textForItem(item);

    if (category.key === 'curiosities') {
      return !hasAny(text, category.exclude || []);
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
        return storeInventory;
      })
      .finally(() => {
        inventoryFetchPromise = null;
      });

    return inventoryFetchPromise;
  }

  function getItemsForCategory(category, inventory) {
    const filtered = inventory.filter(item => belongsInCategory(item, category));

    if (category.key === 'latest') {
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
      viewAllLink.href = category.key === 'latest'
        ? storeUrl
        : ebaySearchUrl(category.viewQuery || '');

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

    activeItems = [];
    visibleItemCount = initialVisibleCount;
    if (productsGrid) productsGrid.innerHTML = '';
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
  }

  function productCardMarkup(item) {
    return `
      <article class="product-card">
        <a class="product-image" href="${item.url || storeUrl}" target="_blank" rel="noopener noreferrer">
          <img loading="lazy" src="${item.image || 'https://via.placeholder.com/300x220?text=JoMagicBackpack'}" alt="${item.title || 'JoMagicBackpack item'}">
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