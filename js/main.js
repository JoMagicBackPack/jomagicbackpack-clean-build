document.addEventListener('DOMContentLoaded', () => {
  // Toggle navigation menu on smaller screens
  const menuToggle = document.querySelector('.menu-toggle');
  const navList = document.querySelector('.nav-list');
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      navList.classList.toggle('show');
    });
  }

  // Fetch and display latest products from the eBay RSS feed via rss2json
  const feedUrl = 'https://api.rss2json.com/v1/api.json?rss_url=https://www.ebay.com/sch/i.html?_rss=1&_sasl=jomagicbackpack&_sop=10';
  fetch(feedUrl)
    .then(response => response.json())
    .then(data => {
      const productsGrid = document.querySelector('.products-grid');
      if (!productsGrid) return;
      // Clear any static product cards
      productsGrid.innerHTML = '';

      data.items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // Image
        const img = document.createElement('img');
        img.src = item.thumbnail || (item.enclosure && item.enclosure.link) || 'https://via.placeholder.com/200x150';
        img.alt = item.title || 'Product image';

        // Title
        const title = document.createElement('h3');
        title.textContent = item.title;

        // Description
        const desc = document.createElement('p');
        desc.textContent = item.contentSnippet || '';

        // Extract price from the content HTML if present
        let priceText = '';
        if (item.content) {
          const match = item.content.match(/\$[0-9.,]+/);
          if (match) {
            priceText = match[0];
          }
        }
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = priceText;

        // Assemble card
        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(price);

        productsGrid.appendChild(card);
      });
    })
    .catch(error => {
      console.error('Error fetching products:', error);
    });
});
