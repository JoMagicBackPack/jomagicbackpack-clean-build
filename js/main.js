document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle');
  const navList = document.querySelector('.nav-list');

  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      navList.classList.toggle('show');
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
      query: 'a'
    },
    {
      key: 'clothing',
      label: 'Clothing',
      heading: 'Clothing',
      description: 'Shirts, jackets, sweaters, pants, and other wearable finds.',
      query: 'shirt jacket sweater pants clothing'
    },
    {
      key: 'shoes',
      label: 'Shoes',
      heading: 'Shoes',
      description: 'Shoes, boots, sneakers, sandals, and other footwear.',
      query: 'shoes boots sneakers sandals loafers'
    },
    {
      key: 'bags',
      label: 'Bags & Accessories',
      heading: 'Bags & Accessories',
      description: 'Bags, wallets, hats, belts, scarves, jewelry, and smaller oddments.',
      query: 'bag purse wallet clutch backpack hat belt scarf jewelry accessories'
    },
    {
      key: 'home',
      label: 'Home & Housewares',
      heading: 'Home & Housewares',
      description: 'Dishes, glassware, decor, kitchen pieces, and useful home finds.',
      query: 'plate bowl mug vase glass ceramic kitchen decor housewares'
    },
    {
      key: 'collectibles',
      label: 'Collectibles',
      heading: 'Collectibles',
      description: 'Books, toys, media, art, vintage pieces, and category-resistant treasures.',
      query: 'vintage collectible toy figure book media art Disney Pokemon'
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

  function functionUrl(query) {
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('seller', seller);
    url.searchParams.set('q', query || 'a');
    url.searchParams.set('limit', '24');
    return url.toString();
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
      if (item.price) card.appendChild(priceEl);
      productsGrid.appendChild(card);
    });
  }

  function loadCategory(category) {
    if (!category) return;

    setActive(category.key);
    if (heading) heading.textContent = category.heading;
    if (description) description.textContent = category.description;
    if (viewAllLink) {
      viewAllLink.href = category.key === 'latest' ? storeUrl : ebaySearchUrl(category.query);
      viewAllLink.textContent = category.key === 'latest'
        ? 'View all items on eBay'
        : `View all ${category.label} on eBay`;
    }

    setStatus(`Loading ${category.label.toLowerCase()}…`);

    fetch(functionUrl(category.query))
      .then(response => response.json())
      .then(data => {
        if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
          setStatus('The live eBay feed did not return items. Use the view-all link to open the store directly.');
          return;
        }
        renderItems(data.result.items);
      })
      .catch(error => {
        console.error(error);
        setStatus('The live eBay feed did not load. Use the view-all link to open the store directly.');
      });
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
