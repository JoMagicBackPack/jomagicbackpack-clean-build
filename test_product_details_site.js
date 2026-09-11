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
});

test('details omit unavailable fields and active filtering excludes unavailable inventory', () => {
  const js = read('js/main.js');
  assert.match(js, /function isActiveItem/);
  assert.match(js, /liveItems\.filter\(isActiveItem\)/);
  assert.match(js, /descriptionText \?/);
  assert.match(js, /rows\.length \?/);
  assert.doesNotMatch(js, /Buy Direct|checkout|stripe/i);
});

test('responsive detail styles protect narrow screens', () => {
  const css = read('css/styles.css');
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /product-details-layout \{ grid-template-columns: 1fr/);
});
