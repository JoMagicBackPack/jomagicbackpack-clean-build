document.addEventListener('DOMContentLoaded', () => {
  const categoryShowcase = document.getElementById('categoryShowcase');
  if (!categoryShowcase) return;

  function animateCount(numberNode, target) {
    const duration = 900;
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

    center.querySelectorAll('.category-orbit-text').forEach(node => node.remove());

    const title = center.querySelector('.category-wheel-title');
    if (title) title.textContent = 'All Items';

    const small = center.querySelector('small');
    if (small) {
      const text = small.textContent.trim();
      const match = text.match(/^(\d+)\s+(.*)$/);
      if (match) {
        const count = Number(match[1]);
        small.innerHTML = `<span class="category-count-number">0</span><span class="category-count-label">${match[2].replace(/finds/i, 'listings')}</span>`;
        const numberNode = small.querySelector('.category-count-number');
        if (numberNode && Number.isFinite(count)) animateCount(numberNode, count);
      }
    }

    center.dataset.centerPolished = 'true';
  }

  polishCenter();
  new MutationObserver(polishCenter).observe(categoryShowcase, { childList: true, subtree: true });
});
