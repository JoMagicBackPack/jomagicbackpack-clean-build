/**
 * Netlify Function: ebay-listings
 * Fetch eBay items via the Buy Browse API using OAuth Client Credentials.
 *
 * Query params:
 *  - q: search keywords
 *  - seller: seller username (optional, can be defaulted via env)
 *  - limit: 1..200 per page (default 12)
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

const RESP_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, max-age=0',
};

const DEFAULT_STORE_QUERY = '(a,e,i,o,u,y,0,1,2,3,4,5,6,7,8,9)';
const LEGACY_STORE_QUERY = 'a';

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
  const useWideStoreSearch = seller && (!q || q === LEGACY_STORE_QUERY);

  const searchQ = useWideStoreSearch ? DEFAULT_STORE_QUERY : q;
  if (searchQ) params.set('q', searchQ);

  const filterParts = ['buyingOptions:{FIXED_PRICE|BEST_OFFER|AUCTION}'];
  if (seller) {
    filterParts.unshift(`sellers:{${seller}}`);
  }
  params.set('filter', filterParts.join(','));

  const pageLimit = useWideStoreSearch ? Math.max(limit, 200) : limit;
  params.set('limit', String(Math.max(1, Math.min(pageLimit, 200))));

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