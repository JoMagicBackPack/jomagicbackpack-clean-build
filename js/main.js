document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const navList = document.querySelector('.nav-list');

  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      navList.classList.toggle('show');
    });
  }

  const backpackGate = document.getElementById('backpackGate');
  const openBackpack = document.getElementById('openBackpack');
  const shopInterface = document.getElementById('shopInterface');

  if (openBackpack && backpackGate && shopInterface) {
    openBackpack.addEventListener('click', () => {
      backpackGate.classList.add('opened');
      shopInterface.classList.add('is-visible');
      shopInterface.setAttribute('aria-hidden', 'false');
      shopInterface.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const seller = 'jomagicbackpack';
  const storeUrl = `https://www.ebay.com/str/${seller}`;

  const categories = [
    {
      key: 'latest',
      label: 'Latest Finds',
      heading: 'Latest Finds',
      description: 'Fresh pieces currently showing from the backpack.',
      queries: ['a'],
      include: [],
      exclude: []
    },
    {
      key: 'clothing',
      label: 'Clothing',
      heading: 'Clothing',
      description: 'Shirts, jackets, sweaters, pants, and other wearable finds.',
      queries: ['shirt', 'jacket', 'sweater', 'pants'],
      include: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'shorts', 'coat', 'vest', 'flannel', 'hoodie', 'dress', 'skirt', 'blouse', 'top'],
      exclude: ['doll', 'toy', 'figure', 'figurine', 'wall', 'decor', 'ornament', 'plate', 'mug', 'book', 'poster', 'print', 'art']
    },
    {
      key: 'shoes',
      label: 'Shoes',
      heading: 'Shoes',
      description: 'Actual wearable shoes, boots, sneakers, sandals, and other footwear.',
      queries: ['shoes', 'boots', 'sneakers', 'sandals'],
      include: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'sandal', 'sandals', 'loafer', 'loafers', 'heel', 'heels', 'cleat', 'cleats', 'slipper', 'slippers', 'footwear'],
      exclude: ['figurine', 'figure', 'mini', 'miniature', 'tiny', 'doll', 'toy', 'wall', 'decor', 'decoration', 'ornament', 'charm', 'pin', 'brooch', 'pendant', 'plaque', 'sign', 'art', 'print', 'poster', 'picture', 'painting', 'ceramic', 'porcelain', 'resin', 'glass', 'bookend', 'ashtray']
    },
    {
      key: 'bags',
      label: 'Bags & Accessories',
      heading: 'Bags & Accessories',
      description: 'Bags, wallets, hats, belts, scarves, jewelry, and smaller wearable accessories.',
      queries: ['bag', 'purse', 'wallet', 'backpack', 'hat'],
      include: ['bag', 'purse', 'wallet', 'backpack', 'tote', 'clutch', 'satchel', 'hat', 'cap', 'belt', 'scarf', 'jewelry', 'necklace', 'bracelet', 'earrings', 'brooch', 'pin'],
      exclude: ['wall', 'decor', 'plate', 'mug', 'bowl', 'vase', 'book', 'toy', 'figure', 'figurine', 'poster', 'print']
    },
    {
      key: 'home',
      label: 'Home & Housewares',
      heading: 'Home & Housewares',
      description: 'Dishes, glassware, decor, kitchen pieces, and useful home finds.',
      queries: ['plate', 'bowl', 'mug', 'vase', 'glass', 'decor'],
      include: ['plate', 'bowl', 'mug', 'cup', 'vase', 'glass', 'ceramic', 'porcelain', 'kitchen', 'decor', 'wall', 'plaque', 'frame', 'figurine', 'figure', 'statue', 'candle', 'dish', 'tray', 'canister'],
      exclude: ['shirt', 'jacket', 'sweater', 'pants', 'jeans', 'sneaker', 'sneakers', 'boot', 'boots', 'sandals', 'purse', 'wallet']
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      heading: 'Collectibles',
      description: 'Books, toys, media, art, vintage pieces, and category-resistant treasures.',
      queries: ['vintage', 'collectible', 'toy', 'book', 'art', 'Pokemon'],
      include: ['vintage', 'collectible', 'toy', 'figure', 'figurine', 'book', 'media', 'art', 'pokemon', 'disney', 'dvd', 'cd', 'vhs', 'game', 'poster', 'print', 'ornament', 'miniature'],
      exclude: []
    }
  ];

  const productsGrid = document.querySelector('.products-grid');
  const categoryControls = document.getElementById('categoryControls');
  const heading = document.getElementById('products-heading');
  const description = document.getElementById('products-description');
  const viewAllLink = document.getElementById('viewAllCategory');
  const scrollLeft = document.getElementById('scrollLeft');
  const scrollRight = document.getElementById('scrollRight');

  function ebaySearchUrl(query) {
    const url = new URL('https://www.ebay.com/sch/i.html');
    url.searchParams.set('_ssn', seller);
    if (query && query !== 'a') url.searchParams.set('_nkw', query);
    return url.toString();
  }

  function functionUrl(query, limit = 8) {
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('seller', seller);
    url.searchParams.set('q', query || 'a');
    url.searchParams.set('limit', String(limit));
    return url.toString();
  }

  function textForItem(item) {
    return [item.title, item.condition, item.seller]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function hasAny(text, words) {
    if (!words || words.length === 0) return false;
    return words.some(word => text.includes(word.toLowerCase()));
  }

  function belongsInCategory(item, category) {
    if (!category || category.key === 'latest') return true;

    const text = textForItem(item);
    const included = hasAny(text, category.include);
    const excluded = hasAny(text, category.exclude);

    return included && !excluded;
  }

  function setActive(key) {
    document.querySelectorAll('.category-pill').forEach(button => {
      button.classList.toggle('is-active', button.dataset.category === key);
    });
  }

  function setStatus(message) {
    if (!productsGrid) return;
    productsGrid.innerHTML = `<div class="product-status">${message}</div>`;
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

  async function fetchItemsForCategory(category) {
    const responses = await Promise.allSettled(
      category.queries.map(query =>
        fetch(functionUrl(query))
          .then(response => response.json())
          .then(data => {
            if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
              return [];
            }
            return data.result.items;
          })
      )
    );

    const combined = responses.flatMap(result =>
      result.status === 'fulfilled' ? result.value : []
    );

    return uniqueItems(combined)
      .filter(item => belongsInCategory(item, category))
      .slice(0, 24);
  }

  function renderItems(items) {
    if (!productsGrid) return;

    if (!items || items.length === 0) {
      setStatus('No matching items loaded here. Use the view-all link to open the full eBay results.');
      return;
    }

    productsGrid.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'product-card';

      const link = document.createElement('a');
      link.href = item.url || storeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'product-image';

      const img = document.createElement('img');
      img.src = item.image || 'https://via.placeholder.com/300x220?text=JoMagicBackpack';
      img.alt = item.title || 'JoMagicBackpack item';
      link.appendChild(img);

      const titleEl = document.createElement('h3');
      titleEl.textContent = item.title || 'JoMagicBackpack item';

      const priceEl = document.createElement('p');
      priceEl.className = 'price';
      priceEl.textContent = item.price || '';

      card.appendChild(link);
      card.appendChild(titleEl);

      if (item.price) {
        card.appendChild(priceEl);
      }

      productsGrid.appendChild(card);
    });
  }

  async function loadCategory(category) {
    if (!category) return;

    setActive(category.key);

    if (heading) heading.textContent = category.heading;
    if (description) description.textContent = category.description;

    const viewQuery = category.queries.find(query => query !== 'a') || '';

    if (viewAllLink) {
      viewAllLink.href = category.key === 'latest'
        ? storeUrl
        : ebaySearchUrl(viewQuery);

      viewAllLink.textContent = category.key === 'latest'
        ? 'View all items on eBay'
        : `View all ${category.label} on eBay`;
    }

    setStatus(`Loading ${category.label.toLowerCase()}…`);

    try {
      const items = await fetchItemsForCategory(category);
      renderItems(items);
    } catch (error) {
      console.error(error);
      setStatus('The live eBay feed did not load. Use the view-all link to open the store directly.');
    }
  }

  if (categoryControls) {
    categoryControls.innerHTML = categories.map(category => (
      `<button class="category-pill" type="button" data-category="${category.key}">${category.label}</button>`
    )).join('');

    categoryControls.addEventListener('click', event => {
      const button = event.target.closest('.category-pill');

      if (!button) return;

      const category = categories.find(item => item.key === button.dataset.category);
      loadCategory(category);
    });
  }

  if (scrollLeft && productsGrid) {
    scrollLeft.addEventListener('click', () => {
      productsGrid.scrollBy({ left: -320, behavior: 'smooth' });
    });
  }

  if (scrollRight && productsGrid) {
    scrollRight.addEventListener('click', () => {
      productsGrid.scrollBy({ left: 320, behavior: 'smooth' });
    });
  }

  loadCategory(categories[0]);
});
