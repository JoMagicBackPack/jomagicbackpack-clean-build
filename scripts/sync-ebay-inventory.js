#!/usr/bin/env node

/*
 * Safely merges active eBay listings into data/inventory.json.
 *
 * This script is intentionally conservative:
 * - Existing items keep categoryOverride and hand-corrected categories.
 * - New eBay items are added, not used to replace the whole catalog.
 * - Missing eBay items are not removed unless EBAY_SYNC_REMOVE_MISSING=true.
 */

const fs = require('fs/promises');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const inventoryPath = path.resolve(repoRoot, process.env.INVENTORY_PATH || 'data/inventory.json');
const seller = process.env.EBAY_SELLER || 'jomagicbackpack';
const siteId = process.env.EBAY_SITE_ID || '0';
const compatibilityLevel = process.env.EBAY_COMPATIBILITY_LEVEL || '1231';
const marketplaceHost = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase() === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';
const tradingEndpoint = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase() === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com/ws/api.dll'
  : 'https://api.ebay.com/ws/api.dll';
const dryRun = process.argv.includes('--dry-run');
const removeMissing = /^true$/i.test(process.env.EBAY_SYNC_REMOVE_MISSING || '');
const maxPages = Number(process.env.EBAY_SYNC_MAX_PAGES || 20);
const pageSize = Math.max(1, Math.min(Number(process.env.EBAY_SYNC_PAGE_SIZE || 200), 200));

function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tagValue(xml, tagName) {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i').exec(xml || '');
  return match ? decodeXml(match[1].trim()) : '';
}

function tagBlock(xml, tagName) {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i').exec(xml || '');
  return match ? match[1] : '';
}

function tagBlocks(xml, tagName) {
  const blocks = [];
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'gi');
  let match;
  while ((match = pattern.exec(xml || ''))) {
    blocks.push(match[1]);
  }
  return blocks;
}

function currentPrice(block) {
  const match = /<CurrentPrice(?:\s[^>]*)?currencyID="([^"]+)"[^>]*>([\s\S]*?)<\/CurrentPrice>/i.exec(block || '');
  if (match) return `${match[1]} ${Number(decodeXml(match[2]).trim()).toFixed(2)}`;
  const value = tagValue(block, 'CurrentPrice');
  return value ? `USD ${Number(value).toFixed(2)}` : null;
}

function normalizeId(value = '') {
  const text = String(value);
  const legacyMatch = text.match(/\b\d{9,15}\b/);
  return legacyMatch ? legacyMatch[0] : text.trim();
}

function normalizeUrl(itemId, url) {
  if (url) return url;
  return itemId ? `https://www.ebay.com/itm/${itemId}` : `https://www.ebay.com/str/${seller}`;
}

function nonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function categoryNameFromBlock(block) {
  const categoryBlock = tagBlock(block, 'PrimaryCategory');
  return tagValue(categoryBlock, 'CategoryName');
}

function inferredCategoryNameFromTitle(title = '') {
  const text = String(title).toLowerCase();
  const matches = (pattern) => pattern.test(text);

  if (matches(/\b(shoes?|boots?|flats?|sandals?|loafers?|sneakers?|slippers?|heels?)\b/)) return 'Shoes';
  if (matches(/\b(hats?|caps?|scarves?|wraps?|gloves?|belts?|purses?|handbags?|bags?|necklaces?|pendants?|cufflinks?|jewelry|pins?)\b/)) return 'Accessories';
  if (matches(/\b(shirts?|t-?shirts?|tees?|sweaters?|hoodies?|jackets?|coats?|vests?|jeans|pants|shorts|jerseys?|dresses?)\b/)) return 'Clothing';
  if (matches(/\b(cross stitch|embroidery|needlepoint|craft kit|ornament kit|activity books?|fabric|yarn|sewing|patterns?)\b/)) return 'Crafts';
  if (matches(/\b(books?|manuals?|postcards?|paper|magazines?)\b/)) return 'Books';
  if (matches(/\b(plates?|bowls?|mugs?|cups?|saucers?|goblets?|glasses?|drinkware|canisters?|jars?|pitchers?|creamers?|sugar bowl|salt and pepper|shakers?|casseroles?|cutting boards?|trivets?|coasters?|colanders?|ice cream maker)\b/)) return 'Kitchen & Dining';
  if (matches(/\b(blankets?|quilts?|tapestr(?:y|ies)|vases?|mirrors?|lamps?|plaques?|wall|pillows?|suncatchers?|mobiles?|decor|decorative|boxes?|tins?)\b/)) return 'Home Decor';
  if (matches(/\b(toys?|plush|dolls?|disney|pokemon|harry potter|star wars|breyer|action figures?)\b/)) return 'Toys & Character';
  if (matches(/\b(figurines?|sculptures?|paperweights?|memorabilia|movie cameras?|statues?|figures?)\b/)) return 'Collectibles';

  return '';
}

function applyInferredCategories(items) {
  let inferred = 0;
  for (const item of items) {
    if (Array.isArray(item.categories) && item.categories.length) continue;
    const categoryName = inferredCategoryNameFromTitle(item.title);
    if (!categoryName) continue;
    item.categories = [{ categoryName }];
    inferred += 1;
  }
  return inferred;
}

function normalizeTradingItem(block) {
  const id = normalizeId(tagValue(block, 'ItemID'));
  const categoryName = categoryNameFromBlock(block);
  const image = tagValue(tagBlock(block, 'PictureDetails'), 'GalleryURL')
    || tagValue(tagBlock(block, 'PictureDetails'), 'PictureURL');
  const url = tagValue(tagBlock(block, 'ListingDetails'), 'ViewItemURL');
  const startTime = tagValue(tagBlock(block, 'ListingDetails'), 'StartTime');

  return {
    id,
    title: tagValue(block, 'Title'),
    price: currentPrice(tagBlock(block, 'SellingStatus')),
    condition: tagValue(block, 'ConditionDisplayName') || null,
    image: image || null,
    url: normalizeUrl(id, url),
    seller,
    startTime,
    categories: categoryName ? [{ categoryName }] : [],
  };
}

function normalizeBrowseItem(item) {
  const price = item.price || item.currentBidPrice || item.minPrice || null;
  const id = normalizeId(item.legacyItemId || item.itemId || item.itemHref || item.itemWebUrl || item.title);
  const categories = Array.isArray(item.categories)
    ? item.categories.map(category => ({
      categoryName: category.categoryName || category.categoryId || '',
    })).filter(category => category.categoryName)
    : [];

  return {
    id,
    title: item.title || '',
    price: price && price.value != null ? `${price.currency || 'USD'} ${Number(price.value).toFixed(2)}` : null,
    condition: item.condition || null,
    image: item?.image?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || null,
    url: normalizeUrl(id, item.itemWebUrl || item.itemAffiliateWebUrl || null),
    seller,
    startTime: item.itemCreationDate || item.itemOriginDate || item.itemStartDate || null,
    categories,
  };
}

async function getOAuthAccessToken() {
  if (process.env.EBAY_OAUTH_ACCESS_TOKEN) return process.env.EBAY_OAUTH_ACCESS_TOKEN;
  if (!process.env.EBAY_REFRESH_TOKEN || !process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) return '';

  const scope = process.env.EBAY_OAUTH_SCOPE || 'https://api.ebay.com/oauth/api_scope';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.EBAY_REFRESH_TOKEN,
    scope,
  });
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${marketplaceHost}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`eBay OAuth refresh failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token || '';
}

async function getClientCredentialsToken() {
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) return '';

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: process.env.EBAY_BROWSE_SCOPE || 'https://api.ebay.com/oauth/api_scope',
  });
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${marketplaceHost}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`eBay client token failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token || '';
}

async function fetchTradingItemCategory(itemId, oauthToken, authToken) {
  const requesterCredentials = authToken
    ? `<RequesterCredentials><eBayAuthToken>${escapeXml(authToken)}</eBayAuthToken></RequesterCredentials>`
    : '';
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${requesterCredentials}
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${escapeXml(itemId)}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <Version>${compatibilityLevel}</Version>
</GetItemRequest>`;

  const headers = {
    'Content-Type': 'text/xml',
    'X-EBAY-API-CALL-NAME': 'GetItem',
    'X-EBAY-API-SITEID': siteId,
    'X-EBAY-API-COMPATIBILITY-LEVEL': compatibilityLevel,
  };
  if (oauthToken) headers['X-EBAY-API-IAF-TOKEN'] = oauthToken;

  const response = await fetch(tradingEndpoint, { method: 'POST', headers, body: xml });
  const text = await response.text();
  if (!response.ok) throw new Error(`GetItem failed for ${itemId}: ${text}`);

  const ack = tagValue(text, 'Ack');
  if (!/^(Success|Warning)$/i.test(ack)) throw new Error(`GetItem returned ${ack || 'no Ack'} for ${itemId}: ${text}`);

  return categoryNameFromBlock(tagBlock(text, 'Item'));
}

async function enrichMissingTradingCategories(items, oauthToken, authToken) {
  const missing = items.filter(item => !Array.isArray(item.categories) || !item.categories.length);
  const limit = Math.max(0, Number(process.env.EBAY_SYNC_CATEGORY_ENRICH_LIMIT || 50));
  let enriched = 0;

  for (const item of missing.slice(0, limit)) {
    try {
      const categoryName = await fetchTradingItemCategory(item.id, oauthToken, authToken);
      if (!categoryName) continue;
      item.categories = [{ categoryName }];
      enriched += 1;
    } catch (error) {
      console.warn(`Could not enrich category for ${item.id}: ${error.message}`);
    }
  }

  return enriched;
}

async function fetchTradingListings() {
  const oauthToken = await getOAuthAccessToken();
  const authToken = process.env.EBAY_AUTH_TOKEN || '';
  if (!oauthToken && !authToken) return null;

  const items = [];
  let totalPages = 1;

  for (let page = 1; page <= Math.min(totalPages, maxPages); page += 1) {
    const requesterCredentials = authToken
      ? `<RequesterCredentials><eBayAuthToken>${escapeXml(authToken)}</eBayAuthToken></RequesterCredentials>`
      : '';
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  ${requesterCredentials}
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${pageSize}</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
  <Version>${compatibilityLevel}</Version>
</GetMyeBaySellingRequest>`;

    const headers = {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
      'X-EBAY-API-SITEID': siteId,
      'X-EBAY-API-COMPATIBILITY-LEVEL': compatibilityLevel,
    };
    if (oauthToken) headers['X-EBAY-API-IAF-TOKEN'] = oauthToken;

    const response = await fetch(tradingEndpoint, { method: 'POST', headers, body: xml });
    const text = await response.text();
    if (!response.ok) throw new Error(`GetMyeBaySelling failed: ${text}`);

    const ack = tagValue(text, 'Ack');
    if (!/^(Success|Warning)$/i.test(ack)) throw new Error(`GetMyeBaySelling returned ${ack || 'no Ack'}: ${text}`);

    const activeList = tagBlock(text, 'ActiveList');
    items.push(...tagBlocks(activeList, 'Item').map(normalizeTradingItem).filter(item => item.id && item.title));
    totalPages = Number(tagValue(tagBlock(activeList, 'PaginationResult'), 'TotalNumberOfPages')) || totalPages;
  }

  const enrichedCategories = await enrichMissingTradingCategories(items, oauthToken, authToken);
  const inferredCategories = applyInferredCategories(items);

  return { items, complete: true, provider: 'trading', enrichedCategories, inferredCategories };
}

async function fetchBrowseListings() {
  const token = await getClientCredentialsToken();
  if (!token) return null;

  const queries = (process.env.EBAY_BROWSE_QUERIES || 'a,e,i,o,u,y,0,1,2,3,4,5,6,7,8,9')
    .split(',')
    .map(query => query.trim())
    .filter(Boolean);
  const items = [];
  const seenUrls = new Set();

  for (const query of queries) {
    let url = new URL(`${marketplaceHost}/buy/browse/v1/item_summary/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('filter', `sellers:{${seller}},buyingOptions:{FIXED_PRICE|BEST_OFFER|AUCTION}`);
    url.searchParams.set('limit', '50');
    url.searchParams.set('sort', 'newlyListed');
    url.searchParams.set('fieldgroups', 'EXTENDED');

    for (let page = 0; page < Math.min(maxPages, 6) && url; page += 1) {
      const urlKey = url.toString();
      if (seenUrls.has(urlKey)) break;
      seenUrls.add(urlKey);

      const response = await fetch(urlKey, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Browse search failed: ${await response.text()}`);
      const data = await response.json();
      const pageItems = Array.isArray(data.itemSummaries) ? data.itemSummaries.map(normalizeBrowseItem) : [];
      items.push(...pageItems.filter(item => item.id && item.title));
      url = data.next ? new URL(data.next) : null;
    }
  }

  const inferredCategories = applyInferredCategories(items);

  return { items, complete: false, provider: 'browse', enrichedCategories: 0, inferredCategories };
}

function mergeListing(existing, listing) {
  const merged = { ...existing };
  for (const key of ['title', 'price', 'condition', 'image', 'url', 'seller', 'startTime']) {
    if (nonEmpty(listing[key])) merged[key] = listing[key];
  }
  if ((!Array.isArray(merged.categories) || !merged.categories.length) && listing.categories?.length) {
    merged.categories = listing.categories;
  }
  if (existing.categoryOverride) merged.categoryOverride = existing.categoryOverride;
  return merged;
}

async function main() {
  const raw = await fs.readFile(inventoryPath, 'utf8');
  const inventory = JSON.parse(raw);
  const currentItems = Array.isArray(inventory.items) ? inventory.items : [];

  const live = await fetchTradingListings() || await fetchBrowseListings();
  if (!live) {
    console.log('No eBay credentials found. Add repository secrets before automatic sync can run.');
    console.log('Needed: EBAY_REFRESH_TOKEN + EBAY_CLIENT_ID + EBAY_CLIENT_SECRET, or EBAY_AUTH_TOKEN.');
    return;
  }

  const existingById = new Map(currentItems.map(item => [normalizeId(item.id || item.url || item.title), item]));
  const liveById = new Map();
  let added = 0;
  let updated = 0;

  for (const listing of live.items) {
    const id = normalizeId(listing.id);
    if (!id || liveById.has(id)) continue;
    liveById.set(id, listing);

    const existing = existingById.get(id);
    if (existing) {
      const merged = mergeListing(existing, listing);
      if (JSON.stringify(existing) !== JSON.stringify(merged)) {
        Object.assign(existing, merged);
        updated += 1;
      }
    } else {
      currentItems.push(listing);
      existingById.set(id, listing);
      added += 1;
    }
  }

  let removed = 0;
  if (removeMissing) {
    if (!live.complete && !/^true$/i.test(process.env.EBAY_SYNC_ALLOW_INCOMPLETE_REMOVE || '')) {
      throw new Error('Refusing to remove missing items from an incomplete Browse API result.');
    }
    inventory.items = currentItems.filter(item => {
      const keep = liveById.has(normalizeId(item.id || item.url || item.title));
      if (!keep) removed += 1;
      return keep;
    });
  } else {
    inventory.items = currentItems;
  }

  const nextJson = `${JSON.stringify(inventory, null, 2)}\n`;
  if (!dryRun && nextJson !== raw) {
    await fs.writeFile(inventoryPath, nextJson, 'utf8');
  }

  console.log(`eBay sync provider: ${live.provider}${live.complete ? ' (complete)' : ' (search based)'}`);
  console.log(`Categories filled from item details: ${live.enrichedCategories || 0}`);
  console.log(`Categories inferred from titles: ${live.inferredCategories || 0}`);
  console.log(`Live listings found: ${liveById.size}`);
  console.log(`Inventory before: ${currentItems.length - added + removed}`);
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Removed: ${removed}`);
  console.log(`Inventory after: ${inventory.items.length}`);
  if (dryRun) console.log('Dry run only; no file written.');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
