document.addEventListener('DOMContentLoaded', () => {
  const categoryShowcase = document.getElementById('categoryShowcase');
  if (!categoryShowcase) return;

  function animateCount(numberNode, target) {
    const duration = 850;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      numberNode.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  function polishCenter() {
    const center = categoryShowcase.querySelector('.category-wheel-center');
    if (!center || center.dataset.centerPolished === 'true') return;

    const small = center.querySelector('small');
    if (small) {
      const text = small.textContent.trim();
      const match = text.match(/^(\d+)\s+(.*)$/);
      if (match) {
        const count = Number(match[1]);
        small.innerHTML = `<span class="category-count-number">0</span><span class="category-count-label">${match[2]}</span>`;
        const numberNode = small.querySelector('.category-count-number');
        if (numberNode && Number.isFinite(count)) animateCount(numberNode, count);
      }
    }

    if (!center.querySelector('.category-orbit-text')) {
      const orbitText = document.createElement('span');
      orbitText.className = 'category-orbit-text';
      orbitText.setAttribute('aria-hidden', 'true');
      orbitText.textContent = 'All Items - All Items - All Items';
      center.insertBefore(orbitText, center.firstChild);
    }

    center.dataset.centerPolished = 'true';
  }

  polishCenter();
  new MutationObserver(polishCenter).observe(categoryShowcase, { childList: true, subtree: true });
});
