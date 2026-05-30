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
- `scripts/sync-ebay-inventory.js` - safe eBay-to-site inventory merge script
- `.github/workflows/sync-ebay-inventory.yml` - scheduled GitHub Action for automatic inventory sync

## Inventory

The Backpack page first tries the live Netlify eBay feed. If the live feed fails or returns too few items, it loads `data/inventory.json`; if that is unavailable, it falls back to `data/inventory.csv`. Items are assigned to one shopper-friendly category first, mostly from the eBay category name, so loose title keywords do not make non-clothing items appear in Clothing or decorative objects appear in Shoes.

To manually move a specific item, add `categoryOverride` to that item in `data/inventory.json`. Valid values are `clothing`, `footwear`, `accessories`, `kitchen`, `home`, `toys`, `crafts`, `books`, `collectibles`, and `other`.

## Automatic eBay Sync

The sync workflow is designed to preserve the hand-corrected Backpack categories. It reads live eBay listings, merges new or changed listing details into `data/inventory.json`, and never replaces the whole inventory file with raw eBay search results.

The preferred setup uses seller-authorized eBay access through GitHub repository secrets:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN`

As an older fallback, `EBAY_AUTH_TOKEN` can be used instead of the refresh-token setup.

When those secrets are present, the GitHub Action runs hourly and commits only `data/inventory.json` if eBay has new or updated listings. By default it does not remove existing inventory entries that are missing from eBay, which protects category work from bad or partial API results. To allow removals after the seller-authenticated sync is confirmed reliable, set the repository variable `EBAY_SYNC_REMOVE_MISSING` to `true`.
