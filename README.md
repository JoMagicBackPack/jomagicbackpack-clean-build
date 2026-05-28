# JoMagicBackpack Clean Build

This repository contains the JoMagicBackpack website published through Netlify.

## Structure

- `index.html` - main page of the site
- `categories.html` - Backpack inventory page
- `css/styles.css` - site styling
- `js/main.js` - category and inventory display logic
- `data/inventory.json` - full inventory with available eBay image URLs
- `data/inventory.csv` - eBay active-listings export used as the reliable catalog fallback
- `data/reviews.json` - customer review data
- `netlify/functions/ebay-listings.js` - optional live eBay Browse API inventory feed

## Inventory

The Backpack page first tries the live Netlify eBay feed. If the live feed fails or returns too few items, it loads `data/inventory.json`; if that is unavailable, it falls back to `data/inventory.csv`. Items are assigned to one shopper-friendly category first, mostly from the eBay category name, so loose title keywords do not make non-clothing items appear in Clothing or decorative objects appear in Shoes.

To manually move a specific item, add `categoryOverride` to that item in `data/inventory.json`. Valid values are `clothing`, `footwear`, `accessories`, `kitchen`, `home`, `toys`, `crafts`, `books`, `collectibles`, and `other`.
