const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const measurements = require('./js/measurement-parser.js');

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
  assert.match(js, /JoMagicMeasurements/);
  assert.match(js, /Sleeve Type/);
  assert.match(js, /inlineMeasurementRows/);
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
  assert.match(js, /measurements\.isMeasurementRow\(name, value\)/);
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


test('specific apparel labels consume generic aliases from the same source span', () => {
  const rows = measurements.inlineMeasurementRows(['Pit to pit: 21.5 inches', 'Shoulder to shoulder: 18 inches', 'Shoulder to cuff: 27 inches', 'Back length: 29 inches'].join('\n'));
  assert.deepEqual(rows, [['Pit To Pit', '21.5 inches'], ['Shoulder To Shoulder', '18 inches'], ['Shoulder To Cuff', '27 inches'], ['Back Length', '29 inches']]);
  assert.equal(rows.some(([name]) => /^(Shoulder|Length|Cuff)$/i.test(name)), false);
});

test('measurement parser keeps distinct concepts and preserves non-apparel dimensions', () => {
  assert.deepEqual(measurements.inlineMeasurementRows('Front length: 28 in'), [['Front Length', '28 in']]);
  assert.deepEqual(measurements.inlineMeasurementRows('Back length: 29"'), [['Back Length', '29"']]);
  assert.deepEqual(measurements.inlineMeasurementRows('Sleeve: 24 in\nWaist: 24 in'), [['Sleeve', '24 in'], ['Waist', '24 in']]);
  assert.deepEqual(measurements.inlineMeasurementRows('Diameter: 46 in\nHeight: 6.5 in\nOpening diameter: 3.75 in\nWidth: 1.25 in'), [['Diameter', '46 in'], ['Height', '6.5 in'], ['Opening Diameter', '3.75 in'], ['Width', '1.25 in']]);
  assert.equal(measurements.isMeasurementRow('Sleeve Length', 'Long Sleeve'), false);
  assert.equal(measurements.isMeasurementRow('Sleeve', '25 inches'), true);
});


test('offer status, condition hierarchy, and processing use the shared storefront renderer', () => {
  const js = read('js/main.js'); const feed = read('netlify/functions/ebay-listings.js'); const css = read('css/styles.css');
  assert.match(feed, /acceptsBestOffer: buyingOptions\.includes\('BEST_OFFER'\)/);
  assert.match(js, /function acceptsBestOffer/);
  assert.match(js, /acceptsBestOffer\(item\) ? .*or Best Offer/);
  assert.match(js, /function storefrontPrice/);
  assert.match(js, /function conditionPresentation/);
  assert.match(js, /const descriptionText = condition\.about/);
  assert.match(js, /const conditionDetails = condition\.detailed/);
  assert.match(js, /Orders are processed within one business day\./);
  assert.match(css, /product-best-offer/);
  assert.doesNotMatch(js, /Make Offer|offer submission|one-day delivery/i);
});
