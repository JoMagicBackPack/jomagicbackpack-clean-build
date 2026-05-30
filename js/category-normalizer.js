(function () {
  const originalFetch = window.fetch;

  function categoryText(item) {
    return Array.isArray(item?.categories)
      ? item.categories.map(category => category.categoryName || '').join(' ').toLowerCase()
      : '';
  }

  function categoryOverrideFor(item) {
    const title = String(item?.title || '').toLowerCase();
    const category = categoryText(item);

    if (/\b(shoes?|boots?|clogs?|mules?|flats?|sandals?|loafers?|sneakers?|slippers?|heels?|birkenstocks?|tatami)\b/.test(title)) return 'footwear';
    if (/\b(plates?|bowls?|mugs?|cups?|saucers?|goblets?|glasses?|drinkware|canisters?|jars?|pitchers?|creamers?|sugar bowl|salt and pepper|shakers?|casseroles?|cutting boards?|trivets?|coasters?|colanders?|ice cream maker)\b/.test(title)) return 'kitchen';
    if (/(^|\b)(shoes?|footwear|boots?|clogs?|mules?|flats?|sandals?|heels?|slippers?)(\b|$)/.test(category)) return 'footwear';
    if (/(kitchen|dining|plates?|bowls?|mugs?|drinkware|glassware|trivets?|coasters?)/.test(category)) return 'kitchen';

    return '';
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      const override = categoryOverrideFor(item);
      if (override && !item.categoryOverride) item.categoryOverride = override;
    });
  }

  function normalizePayload(payload) {
    if (Array.isArray(payload)) {
      normalizeItems(payload);
      return payload;
    }
    normalizeItems(payload?.items);
    normalizeItems(payload?.result?.items);
    return payload;
  }

  window.fetch = async function normalizedFetch(...args) {
    const response = await originalFetch.apply(this, args);
    const requestUrl = String(args[0]?.url || args[0] || '');
    if (!/(inventory\.json|ebay-listings)/.test(requestUrl)) return response;

    try {
      const payload = normalizePayload(await response.clone().json());
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      return response;
    }
  };
}());
