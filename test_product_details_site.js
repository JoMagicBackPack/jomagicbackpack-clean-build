const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Backpack cards provide compact and expanded eBay paths', () => {
  const html = read('categories.html'); const js = read('js/main.js');
  assert.match(html, /productDetailsDialog/);
  assert.match(js, /Expand for details/);
  assert.match(js, /data-ga4-outbound="ebay"/);
  assert.match(js, /product-details-ebay/);
  assert.match(js, /product-details-top-cta/);
  assert.match(js, /Ready to make it yours/);
});

test('details omit unavailable fields and active filtering excludes unavailable inventory', () => {
  const js = read('js/main.js');
  assert.match(js, /function isActiveItem/);
  assert.match(js, /liveItems\.filter\(isActiveItem\)/);
  assert.match(js, /descriptionText \?/);
  assert.match(js, /function hydrateItemDetails/);
  assert.match(js, /conditionDescription/);
  assert.match(js, /About this find/);
  assert.match(js, /Quick details/);
  assert.match(js, /Measurements/);
  assert.match(js, /privateDetailNames/);
  assert.doesNotMatch(js, /raw\.seller\?\.username/);
  assert.doesNotMatch(js, /Buy Direct|checkout|stripe/i);
});

test('responsive detail styles protect narrow screens', () => {
  const css = read('css/styles.css');
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /product-details-layout \{ grid-template-columns: 1fr/);
  assert.match(css, /product-detail-thumbnails/);
  assert.match(css, /product-quick-details/);
});

test('existing feed supports on-demand active detail hydration', () => {
  const feed = read('netlify/functions/ebay-listings.js');
  assert.match(feed, /requestedItemId/);
  assert.match(feed, /fetchItemById\(token, normalizedItemId\)/);
  assert.match(feed, /conditionDescription/);
  assert.match(feed, /description:/);
});
