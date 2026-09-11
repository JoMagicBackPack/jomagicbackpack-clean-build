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
  assert.match(js, /backpack-icon/);
  assert.match(js, /ebay-wordmark/);
  assert.match(js, /role=\"button\"/);
  assert.match(js, /event.target.closest\('\.product-cta'\)/);
  assert.match(js, /Ready to make it yours/);
});

test('details omit unavailable fields and active filtering excludes unavailable inventory', () => {
  const js = read('js/main.js');
  assert.match(js, /function isActiveItem/);
  assert.match(js, /liveItems\.filter\(isActiveItem\)/);
  assert.match(js, /descriptionText \?/);
  assert.match(js, /function hydrateItemDetails/);
  assert.match(js, /conditionDescription/);
  assert.match(js, /split\(\/\\n\{2,\}\//);
  assert.match(js, /About this find/);
  assert.match(js, /Quick details/);
  assert.match(js, /Measurements/);
  assert.match(js, /privateDetailNames/);
  assert.match(js, /function isMeasurementRow/);
  assert.match(js, /measurementValue/);
  assert.match(js, /Sleeve Type/);
  assert.match(js, /inlinePattern/);
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

test('measurement classifier requires physical numeric values and keeps card navigation local', () => {
  const js = read('js/main.js');
  assert.match(js, /isMeasurementRow\(name, value\)/);
  assert.match(js, /measurementValue\.test\(value\)/);
  assert.match(js, /product-card-open/);
  assert.match(js, /productsGrid\.addEventListener\('keydown'/);
  assert.doesNotMatch(js, /<a class=\"product-image\" href=/);
});

test('product actions prioritize JoMagic details over eBay navigation', () => {
  const js = read('js/main.js'); const css = read('css/styles.css');
  assert.ok(js.indexOf('product-details-trigger') < js.indexOf('product-ebay-cta'));
  assert.doesNotMatch(js, /product-details-top-cta/);
  assert.match(js, /product-details-purchase/);
  assert.match(css, /product-ebay-cta/);
});
