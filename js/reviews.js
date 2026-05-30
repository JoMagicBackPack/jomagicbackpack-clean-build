document.addEventListener('DOMContentLoaded', () => {
  const quoteEl = document.getElementById('reviewQuote');
  const sourceEl = document.getElementById('reviewSource');
  const dotsEl = document.getElementById('reviewDots');
  const prevButton = document.getElementById('reviewPrev');
  const nextButton = document.getElementById('reviewNext');

  if (!quoteEl) return;

  quoteEl.style.fontSize = 'clamp(1.35rem, 2.6vw, 1.85rem)';
  quoteEl.style.lineHeight = '1.62';
  quoteEl.style.letterSpacing = '0';
  quoteEl.style.minHeight = '9rem';
  quoteEl.style.opacity = '1';
  quoteEl.style.transform = 'translateY(0)';
  quoteEl.style.transition = 'opacity 360ms ease, transform 360ms ease';

  if (dotsEl) {
    dotsEl.style.display = 'none';
  }

  let reviews = [];
  let currentIndex = 0;
  let timer = null;

  const fallbackReviews = [
    { quote: 'Great seller. Fast shipping. A+', source: 'eBay buyer feedback', buyer: 'm***7' },
    { quote: 'Exactly as described. Packed with care.', source: 'eBay buyer feedback', buyer: 'r***k' },
    { quote: 'Item arrived safely and as described.', source: 'eBay buyer feedback', buyer: 'c***2' },
    { quote: 'Smooth transaction. Thank you.', source: 'eBay buyer feedback', buyer: 't***x' }
  ];

  function displayReview(text) {
    quoteEl.style.opacity = '0';
    quoteEl.style.transform = 'translateY(8px)';

    window.setTimeout(() => {
      quoteEl.textContent = `"${text}"`;
      quoteEl.style.opacity = '1';
      quoteEl.style.transform = 'translateY(0)';
    }, 220);
  }

  function showReview(index) {
    if (!reviews.length) return;

    currentIndex = (index + reviews.length) % reviews.length;
    const review = reviews[currentIndex];

    displayReview(review.quote);

    if (sourceEl) {
      sourceEl.innerHTML = `${review.source || 'eBay buyer feedback'} <span style="opacity:.7;">- buyer ${review.buyer || 'anonymous'}</span>`;
      sourceEl.style.fontSize = '1.05rem';
      sourceEl.style.marginTop = '1.25rem';
    }
  }

  function nextReview() {
    showReview(currentIndex + 1);
  }

  function previousReview() {
    showReview(currentIndex - 1);
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextReview, 13000);
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

  fetch('data/reviews.json', { cache: 'no-store' })
    .then(response => response.json())
    .then(initializeReviewCarousel)
    .catch(() => initializeReviewCarousel(fallbackReviews));
});
