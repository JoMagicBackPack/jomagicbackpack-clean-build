document.addEventListener('DOMContentLoaded', () => {
  const quoteEl = document.getElementById('reviewQuote');
  const sourceEl = document.getElementById('reviewSource');
  const dotsEl = document.getElementById('reviewDots');
  const prevButton = document.getElementById('reviewPrev');
  const nextButton = document.getElementById('reviewNext');

  if (!quoteEl) return;

  let reviews = [];
  let currentIndex = 0;
  let timer = null;

  const fallbackReviews = [
    { quote: 'Great seller. Fast shipping. A+', source: 'eBay buyer feedback' },
    { quote: 'Exactly as described. Packed with care.', source: 'eBay buyer feedback' },
    { quote: 'Item arrived safely and as described.', source: 'eBay buyer feedback' },
    { quote: 'Smooth transaction. Thank you.', source: 'eBay buyer feedback' }
  ];

  function renderDots() {
    if (!dotsEl) return;

    dotsEl.innerHTML = reviews.map((_, index) => (
      `<button class="review-dot${index === currentIndex ? ' is-active' : ''}" type="button" aria-label="Show review ${index + 1}" data-review-index="${index}"></button>`
    )).join('');
  }

  function showReview(index) {
    if (!reviews.length) return;

    currentIndex = (index + reviews.length) % reviews.length;
    const review = reviews[currentIndex];

    quoteEl.textContent = `“${review.quote}”`;

    if (sourceEl) {
      sourceEl.textContent = review.source || 'eBay buyer feedback';
    }

    renderDots();
  }

  function nextReview() {
    showReview(currentIndex + 1);
  }

  function previousReview() {
    showReview(currentIndex - 1);
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextReview, 6500);
  }

  function initializeReviewCarousel(data) {
    reviews = Array.isArray(data) && data.length ? data : fallbackReviews;
    showReview(0);
    restartTimer();
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      previousReview();
      restartTimer();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      nextReview();
      restartTimer();
    });
  }

  if (dotsEl) {
    dotsEl.addEventListener('click', event => {
      const dot = event.target.closest('.review-dot');
      if (!dot) return;
      showReview(Number(dot.dataset.reviewIndex));
      restartTimer();
    });
  }

  fetch('data/reviews.json', { cache: 'no-store' })
    .then(response => response.json())
    .then(initializeReviewCarousel)
    .catch(() => initializeReviewCarousel(fallbackReviews));
});
