/**
 * Netlify Function: ebay-listings
 * Fetch eBay items via the Buy Browse API using OAuth Client Credentials.
 *
 * Query params:
 *  - q: search keywords
 *  - seller: seller username (optional, can be defaulted via env)
 *  - limit: 1..50 per page (default 12)
 *  - pages: 1..6 pages to fetch server-side when eBay returns a next link
 *  - sort: "new" | "price" | "end" (default "new")
 *  - order: "asc" | "desc" (default "desc"; used with sort=price or sort=end)
 *  - next: absolute "next" link returned by eBay (optional, for server-side paging)
 *
 * Required environment variables:
 *  - EBAY_CLIENT_ID
 *  - EBAY_CLIENT_SECRET
 *  - EBAY_ENV = "PRODUCTION" | "SANDBOX" (default "PRODUCTION")
 *  - EBAY_SCOPE (default "https://api.ebay.com/oauth/api_scope")
 *  - EBAY_DEFAULT_SELLER (optional)
 *  - EBAY_DEFAULT_LIMIT (optional, e.g. "12")
 */
const TOKEN_CACHE = { value: null, exp: 0 };

const DEFAULT_STORE_CATEGORY_IDS = [
  '1', '99', '220', '267', '281', '550', '553', '625', '870', '11450',
  '11700', '14339', '20081', '237', '26395', '2984', '45100', '6000',
  '64482', '888'
];

// Browse search is discovery-oriented and does not always return every older
// active listing for a seller. These verified active IDs fill that gap through
// Browse getItem while normal category aggregation continues to pick up new
// listings automatically.
const DEFAULT_DIRECT_ITEM_IDS = [
  'v1|205926898769|0',
  'v1|204471448616|0',
  'v1|204483503224|0',
  'v1|204494671218|0',
  'v1|204503212049|0',
  'v1|204504358781|0',
  'v1|204504393287|0',
  'v1|204510198954|0',
  'v1|204518930284|0',
  'v1|204520612907|0',
  'v1|204547369870|0',
  'v1|204547403964|0',
  'v1|204548316958|0',
  'v1|204550148138|0',
  'v1|204550243685|0',
  'v1|204583426466|0',
  'v1|204609831559|0',
  'v1|204622265817|0',
  'v1|204624260130|0',
  'v1|204643387282|0',
  'v1|204649929232|0',
  'v1|204670882000|0',
  'v1|204687211107|0',
  'v1|204688150302|0',
  'v1|204688698109|0',
  'v1|204691605291|0',
  'v1|204742361924|0',
  'v1|204753073486|0',
  'v1|204757675766|0',
  'v1|204757779412|0',
  'v1|204816652856|0',
  'v1|204825722544|0',
  'v1|204825730243|0',
  'v1|204825744318|0',
  'v1|204828863308|0',
  'v1|204889137046|0',
  'v1|204955150694|0',
  'v1|204960618472|0',
  'v1|204991885410|0',
  'v1|205013057754|0',
  'v1|205040622331|0',
  'v1|205048240086|0',
];


const RESP_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  // Keep browsers responsive while limiting the roughly 60 Browse calls used
  // to assemble the complete store to safely below eBay's daily default quota.
  'Cache-Control': 'public, max-age=300, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=1800, stale-while-revalidate=3600',
};

const now = () => Math.floor(Date.now() / 1000);
const env = (k, d) => (process.env[k] ?? d);

const EBAY_ENV = String(env('EBAY_ENV', 'PRODUCTION')).toUpperCase();
const API_HOST = EBAY_ENV === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';

function createHttpError(status = 500, message = 'Unexpected error', meta = {}) {
  const err = new Error(message);
  err.statusCode = status;
  err.meta = meta;
  return err;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

async function getAccessToken() {
  if (TOKEN_CACHE.value && TOKEN_CACHE.exp > now() + 30) {
    return TOKEN_CACHE.value;
  }

  const id = env('EBAY_CLIENT_ID');
  const secret = env('EBAY_CLIENT_SECRET');
  const scope = env('EBAY_SCOPE', 'https://api.ebay.com/oauth/api_scope');

  if (!id || !secret) {
    throw createHttpError(500, 'Server is missing eBay credentials.');
  }

  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope });

  const res = await fetch(`${API_HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw createHttpError(res.status, `eBay OAuth failed: ${text}`);
  }

  const data = await res.json();
  TOKEN_CACHE.value = data.access_token;
  TOKEN_CACHE.exp = now() + (data.expires_in || 7200);
  return TOKEN_CACHE.value;
}

function normalizeItemSummary(item) {
  const priceObj = item.price || item.currentBidPrice || item.minPrice || null;
  const imageUrl =
    item?.image?.imageUrl ||
    item?.thumbnailImages?.[0]?.imageUrl ||
    item?.image?.url ||
    null;

  const shipping = Array.isArray(item?.shippingOptions) && item.shippingOptions[0]
    ? item.shippingOptions[0]
    : null;

  const startTime =
    item.itemCreationDate ||
    item.itemOriginDate ||
    item.startTime ||
    item.itemStartDate ||
    null;

  return {
    id: item.itemId || item.legacyItemId || item.epid || String(item.title || Math.random()),
    title: item.title || '',
    price: priceObj && priceObj.value != null
      ? `${priceObj.currency || 'USD'} ${Number(priceObj.value).toFixed(2)}`
      : null,
    condition: item?.condition || item?.itemGroupType || '—',
    image: imageUrl,
    url: item?.itemWebUrl || item?.itemAffiliateWebUrl || item?.itemHref || null,
    seller: item?.seller?.username || null,
    startTime,
    shipping: shipping ? {
      type: shipping?.shippingServiceType || shipping?.optionType || null,
      cost: shipping?.shippingCost && shipping.shippingCost.value != null
        ? `${shipping.shippingCost.currency || 'USD'} ${Number(shipping.shippingCost.value).toFixed(2)}`
        : (shipping?.shippingCost === 0 ? 'USD 0.00' : null),
    } : null,
    raw: item,
  };
}

function buildSearchURL(query) {
  const params = new URLSearchParams();
  const q = (query.q || '').toString().trim();
  const seller = (query.seller || env('EBAY_DEFAULT_SELLER') || '').toString().trim();
  const limit = Number(query.limit || env('EBAY_DEFAULT_LIMIT') || 12);
  const sort = (query.sort || 'new').toString().toLowerCase();
  const order = (query.order || 'desc').toString().toLowerCase();

  const categoryIds = (query.category_ids || query.categoryIds || '').toString().trim();
  if (q) params.set('q', q);
  if (categoryIds) params.set('category_ids', categoryIds);

  const filterParts = ['buyingOptions:{FIXED_PRICE|BEST_OFFER|AUCTION}'];
  if (seller) {
    filterParts.unshift(`sellers:{${seller}}`);
  }
  params.set('filter', filterParts.join(','));

  params.set('limit', String(Math.max(1, Math.min(limit, 50))));

  if (sort === 'price') {
    params.set('sort', `price ${order === 'asc' ? 'asc' : 'desc'}`);
  } else if (sort === 'end') {
    params.set('sort', `endTime ${order === 'asc' ? 'asc' : 'desc'}`);
  } else {
    params.set('sort', 'newlyListed');
  }

  params.set('fieldgroups', 'EXTENDED');

  return `${API_HOST}/buy/browse/v1/item_summary/search?${params.toString()}`;
}

async function fetchSearchPage(token, url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw createHttpError(res.status, `eBay Browse search failed: ${text}`);
  }

  return res.json();
}


async function fetchItemById(token, itemId) {
  const encoded = encodeURIComponent(itemId);
  const res = await fetch(`${API_HOST}/buy/browse/v1/item/${encoded}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) return null;
  const item = await res.json();
  const endMs = item.itemEndDate ? Date.parse(item.itemEndDate) : NaN;
  const availabilityStatuses = Array.isArray(item.estimatedAvailabilities)
    ? item.estimatedAvailabilities
      .map(value => value && value.estimatedAvailabilityStatus)
      .filter(Boolean)
    : [];

  if (Number.isFinite(endMs) && endMs <= Date.now()) return null;
  if (availabilityStatuses.length && availabilityStatuses.every(value => value === 'OUT_OF_STOCK')) {
    return null;
  }

  return normalizeItemSummary(item);
}

async function fetchDirectItems(token, itemIds, batchSize = 8) {
  const items = [];

  // Bounded parallelism avoids the old sequential timeout risk without
  // sending every direct lookup to eBay at the same instant.
  for (let index = 0; index < itemIds.length; index += batchSize) {
    const batch = itemIds.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(itemId => fetchItemById(token, itemId)));
    items.push(...results.filter(Boolean));
  }

  return items;
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.id || item.url || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchItems(token, query) {
  const next = (query.next || '').toString().trim();
  const q = (query.q || '').toString().trim();
  const categoryIds = (query.category_ids || query.categoryIds || '').toString().trim();
  const seller = (query.seller || env('EBAY_DEFAULT_SELLER') || '').toString().trim();
  const shouldAggregateStore = seller && !next && !q && !categoryIds;

  if (shouldAggregateStore) {
    return aggregateStoreItems(token, query);
  }

  const maxPages = Math.max(1, Math.min(Number(query.pages || 1), 6));
  let url = next || buildSearchURL(query);
  let finalHref = url;
  let finalNext = null;
  let total = 0;
  let allItems = [];

  for (let page = 0; page < maxPages && url; page += 1) {
    const data = await fetchSearchPage(token, url);
    const pageItems = Array.isArray(data.itemSummaries) ? data.itemSummaries.map(normalizeItemSummary) : [];

    allItems = allItems.concat(pageItems);
    total = data.total || total || pageItems.length;
    finalHref = data.href || url;
    finalNext = data.next || null;
    url = finalNext;
  }

  const items = uniqueItems(allItems);

  return {
    items,
    total,
    href: finalHref,
    next: finalNext,
    fetched: items.length,
    pagesRequested: maxPages,
  };
}

async function aggregateStoreItems(token, query) {
  const pages = Math.max(1, Math.min(Number(query.pages || 6), 6));
  const categoryIds = String(env('EBAY_STORE_CATEGORY_IDS', DEFAULT_STORE_CATEGORY_IDS.join(',')))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const directItemIds = String(env('EBAY_STORE_DIRECT_ITEM_IDS', DEFAULT_DIRECT_ITEM_IDS.join(',')))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  let allItems = [];
  let categoryTotals = {};
  let hrefs = [];

  for (const categoryId of categoryIds) {
    const result = await searchItems(token, { ...query, category_ids: categoryId, pages });
    allItems = allItems.concat(result.items || []);
    categoryTotals[categoryId] = result.total || 0;
    if (result.href) hrefs.push(result.href);
  }

  allItems = allItems.concat(await fetchDirectItems(token, directItemIds));

  const items = uniqueItems(allItems)
    .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());

  return {
    items,
    total: items.length,
    href: hrefs[0] || null,
    next: null,
    fetched: items.length,
    pagesRequested: pages,
    aggregateMode: 'sellerCategories',
    categoryTotals,
    categoryIds,
    directItemIds,
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: RESP_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers: RESP_HEADERS, body: JSON.stringify({ ok:false, error:'Method Not Allowed' }) };
    }

    const qs = event.queryStringParameters || {};
    const token = await getAccessToken();
    const result = await searchItems(token, qs);

    return {
      statusCode: 200,
      headers: RESP_HEADERS,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (err) {
    const status = err.statusCode || 500;
    return {
      statusCode: status,
      headers: RESP_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: err.message || 'Unexpected error',
        meta: err.meta || null,
      }),
    };
  }
};
