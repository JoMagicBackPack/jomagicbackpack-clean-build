document.addEventListener('DOMContentLoaded', () => {
  // Toggle navigation menu on smaller screens
  const menuToggle = document.querySelector('.menu-toggle');
  const navList = document.querySelector('.nav-list');
  if (menuToggle && navList) {
    menuToggle.addEventListener('click', () => {
      navList.classList.toggle('show');
    });
  }

  // Fetch and display latest products from Netlify eBay function
  const productsGrid = document.querySelector('.products-grid');
  if (productsGrid) {
    fetch('/.netlify/functions/ebay-listings?seller=jomagicbackpack&limit=12')
      .then(response => response.json())
      .then(data => {
        if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
          return;
        }
        productsGrid.innerHTML = '';
        data.result.items.forEach(item => {
          const card = document.createElement('div');
          card.className = 'product-card';
          const imageSrc = item.image || 'https://via.placeholder.com/200x150';

          const link = document.createElement('a');
          link.href = item.url || '#';
          link.target = '_blank';
          link.className = 'product-image';

          const img = document.createElement('img');
          img.src = imageSrc;
          img.alt = item.title || 'product image';
          link.appendChild(img);

          const titleEl = document.createElement('h3');
          titleEl.textContent = item.title || '';

          const priceEl = document.createElement('p');
          priceEl.textContent = item.price || '';

          card.appendChild(link);
          card.appendChild(titleEl);
          card.appendChild(priceEl);

          productsGrid.appendChild(card);
        });
      })
      .catch(err => console.error(err));
  }
});
