document.addEventListener('DOMContentLoaded', () => {
  const categoryShowcase = document.getElementById('categoryShowcase');
  if (!categoryShowcase) return;

  function polishCenter() {
    const center = categoryShowcase.querySelector('.category-wheel-center');
    if (!center || center.dataset.centerPolished === 'true') return;

    const small = center.querySelector('small');
    if (small) {
      const text = small.textContent.trim();
      const match = text.match(/^(\d+)\s+(.*)$/);
      if (match) {
        small.innerHTML = `<span class="category-count-number">${match[1]}</span><span class="category-count-label">${match[2]}</span>`;
      }
    }

    if (!center.querySelector('.category-orbit-text')) {
      const orbitText = document.createElement('span');
      orbitText.className = 'category-orbit-text';
      orbitText.setAttribute('aria-hidden', 'true');
      orbitText.textContent = 'All Items • All Items • All Items';
      center.insertBefore(orbitText, center.firstChild);
    }

    center.dataset.centerPolished = 'true';
  }

  polishCenter();
  new MutationObserver(polishCenter).observe(categoryShowcase, { childList: true, subtree: true });
});
