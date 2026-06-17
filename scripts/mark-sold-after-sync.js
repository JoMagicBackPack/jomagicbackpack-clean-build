#!/usr/bin/env node

/*
 * Marks listings as sold when they disappear from a complete eBay ActiveList sync.
 * Sold records stay in data/inventory.json for EBAY_SYNC_SOLD_RETENTION_DAYS days.
 */

const fs = require('fs/promises');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const inventoryPath = path.resolve(repoRoot, process.env.INVENTORY_PATH || 'data/inventory.json');
const marketplaceHost = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase() === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';
const tradingEndpoint = (process.env.EBAY_ENV || 'PRODUCTION').toUpperCase() === 'SANDBOX'
  ? 'https://api.sandbox.ebay.com/ws/api.dll'
  : 'https://api.ebay.com/ws/api.dll';
const siteId = process.env.EBAY_SITE_ID || '0';
const compatibilityLevel = process.env.EBAY_COMPATIBILITY_LEVEL || '1231';
const maxPages = Number(process.env.EBAY_SYNC_MAX_PAGES || 20);
const pageSize = Math.max(1, Math.min(Number(process.env.EBAY_SYNC_PAGE_SIZE || 200), 200));
const soldRetentionDays = Math.max(1, Number(process.env.EBAY_SYNC_SOLD_RETENTION_DAYS || 14));

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
  while ((match = pattern.exec(xml || ''))) blocks.push(match[1]);
  return blocks;
}

function normalizeId(value = '') {
  const match = String(value).match(/\b\d{9,15}\b/);
  return match ? match[0] : '';
}

function isSold(item) {
  return String(item?.status || '').toLowerCase() === 'sold' || Boolean(item?.soldAt);
}

function soldTime(item) {
  const time = Date.parse(item?.soldAt || '');
  return Number.isFinite(time) ? time : 0;
}

function isExpiredSold(item) {
  const time = soldTime(item);
  if (!isSold(item) || !time) return false;
  return Date.now() - time > soldRetentionDays * 24 * 60 * 60 * 1000;
}

async function getOAuthAccessToken() {
  if (process.env.EBAY_OAUTH_ACCESS_TOKEN) return process.env.EBAY_OAUTH_ACCESS_TOKEN;
  if (!process.env.EBAY_REFRESH_TOKEN || !process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) return '';

  const scope = process.env.EBAY_OAUTH_SCOPE || 'https://api.ebay.com/oauth/api_scope';
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.EBAY_REFRESH_TOKEN,
    scope,
  });

  const response = await fetch(`${marketplaceHost}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) throw new Error(`eBay OAuth refresh failed: ${await response.text()}`);
  const data = await response.json();
  return data.access_token || '';
}

async function fetchActiveIds() {
  const oauthToken = await getOAuthAccessToken();
  const authToken = process.env.EBAY_AUTH_TOKEN || '';
  if (!oauthToken && !authToken) {
    console.log('No Trading-capable eBay token found; sold-status marking skipped.');
    return null;
  }

  const ids = new Set();
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
    tagBlocks(activeList, 'Item').forEach(block => {
      const id = normalizeId(tagValue(block, 'ItemID'));
      if (id) ids.add(id);
    });
    totalPages = Number(tagValue(tagBlock(activeList, 'PaginationResult'), 'TotalNumberOfPages')) || totalPages;
  }

  return ids;
}

async function main() {
  const activeIds = await fetchActiveIds();
  if (!activeIds) return;

  const raw = await fs.readFile(inventoryPath, 'utf8');
  const inventory = JSON.parse(raw);
  const items = Array.isArray(inventory.items) ? inventory.items : [];
  const soldAt = new Date().toISOString();
  let markedSold = 0;
  let reactivated = 0;
  let expired = 0;

  for (const item of items) {
    const id = normalizeId(item.id || item.url || '');
    if (!id) continue;

    if (activeIds.has(id)) {
      if (isSold(item)) {
        delete item.soldAt;
        delete item.soldReason;
        item.status = 'active';
        reactivated += 1;
      }
      continue;
    }

    if (!isSold(item)) {
      item.status = 'sold';
      item.soldAt = soldAt;
      item.soldReason = 'No longer returned by eBay active-listings sync.';
      markedSold += 1;
    }
  }

  inventory.items = items.filter(item => {
    const shouldExpire = isExpiredSold(item);
    if (shouldExpire) expired += 1;
    return !shouldExpire;
  });

  const nextJson = `${JSON.stringify(inventory, null, 2)}\n`;
  if (nextJson !== raw) await fs.writeFile(inventoryPath, nextJson, 'utf8');

  console.log(`Active listings checked: ${activeIds.size}`);
  console.log(`Marked sold: ${markedSold}`);
  console.log(`Reactivated: ${reactivated}`);
  console.log(`Expired sold after ${soldRetentionDays} days: ${expired}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
