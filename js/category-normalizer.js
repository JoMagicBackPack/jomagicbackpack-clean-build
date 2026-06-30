(function () {
  const originalFetch = window.fetch;

  function categoryText(item) {
    return Array.isArray(item?.categories)
      ? item.categories.map(category => category.categoryName || '').join(' ').toLowerCase()
      : '';
  }

  function titleText(item) {
    return String(item?.title || '').toLowerCase();
  }

  function categoryOverrideFor(item) {
    const title = titleText(item);
    const category = categoryText(item);
    const allText = `${category} ${title}`;

    if (/\b(books?|manuals?|postcards?|paper|magazines?|hardcover|paperback|dust jacket)\b/.test(allText)) return 'books';
    if (/\b(plates?|bowls?|mugs?|cups?|saucers?|goblets?|glasses?|drinkware|carafes?|canisters?|jars?|pitchers?|creamers?|sugar bowl|salt and pepper|shakers?|casseroles?|cutting boards?|trivets?|coasters?|colanders?|kitchen|dining|serving)\b/.test(allText)) return 'kitchen';
    if (/\b(board shorts?|swim trunks?|shorts?|shirts?|t-?shirts?|tees?|flannels?|sweaters?|turtlenecks?|hoodies?|jackets?|coats?|sport coats?|blazers?|vests?|jeans|pants|jerseys?|dresses?|apparel)\b/.test(allText) && !/\bdust jacket\b/.test(allText)) return 'clothing';
    if (/\b(shoes?|footwear|boots?|clogs?|mules?|flats?|sandals?|loafers?|sneakers?|slippers?|heels?|birkenstocks?|tatami)\b/.test(allText)) return 'footwear';
    if (/\b(medals?|pendants?|charms?|pins?|clips?|brooches?|jewelry|necklaces?|badges?|cufflinks?|watches?|bags?|purses?|hats?|caps?|belts?|scarves?|gloves?|wallets?)\b/.test(allText)) return 'accessories';
    if (/\b(blankets?|quilts?|vases?|mirrors?|lamps?|wall|decor|decorative|boxes?|tins?|plaques?|tapestr(?:y|ies)|pillows?|suncatchers?|mobiles?|sculptures?)\b/.test(allText)) return 'home';
    if (/\b(toys?|plush|dolls?|disney|pokemon|harry potter|star wars|breyer|action figures?)\b/.test(allText)) return 'toys';
    if (/\b(cross stitch|embroidery|needlepoint|craft|kit|fabric|yarn|sewing|patterns?)\b/.test(allText)) return 'crafts';
    if (/\b(collectibles?|figurines?|paperweights?|memorabilia|statues?|figures?|movie cameras?|religious|devotional|catholic|saint|mary|miraculous)\b/.test(allText)) return 'collectibles';

    return '';
  }

  function normalizeItems(items) {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      const override = categoryOverrideFor(item);
      if (override) item.categoryOverride = override;
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
