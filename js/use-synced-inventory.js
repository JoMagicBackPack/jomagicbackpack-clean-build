(() => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    if (url.includes('/.netlify/functions/ebay-listings')) {
      return Promise.reject(new Error('Using synced inventory file so sold status and hand categories are preserved.'));
    }

    return originalFetch(input, init);
  };
})();
