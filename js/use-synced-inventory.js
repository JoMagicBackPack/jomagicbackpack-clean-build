(() => {
  const originalFetch = window.fetch.bind(window);

  const relistedItems = new Map([
    ['205607211423', {
      id: '206385829861',
      title: 'Woodside Ireland Family Crest Name History Plaque Framed 28x16 HRC',
      url: 'https://www.ebay.com/itm/Woodside-Ireland-Family-Crest-Name-History-Plaque-Framed-28x16-HRC-/206385829861',
      startTime: '2026-07-01T06:05:00.000Z'
    }],
    ['205910055709', {
      id: '206385828695',
      title: 'Pfaltzgraff Vickie Hanson Floral Ceramic Covered Casserole 3 Qt',
      url: 'https://www.ebay.com/itm/Pfaltzgraff-Vickie-Hanson-Floral-Ceramic-Covered-Casserole-3-Qt-/206385828695',
      startTime: '2026-07-01T05:58:00.000Z'
    }],
    ['205910057930', {
      id: '206385828758',
      title: 'The Territory Ahead Mens Large Cotton Shirt Tan Striped Short Sleeve',
      url: 'https://www.ebay.com/itm/The-Territory-Ahead-Mens-Large-Cotton-Shirt-Tan-Striped-Short-Sleeve-/206385828758',
      startTime: '2026-07-01T05:58:00.000Z'
    }],
    ['205910062131', {
      id: '206385828806',
      title: 'Vintage Oversized Apple Pear Ceramic Fruit Sculptures Set of 2',
      url: 'https://www.ebay.com/itm/Vintage-Oversized-Apple-Pear-Ceramic-Fruit-Sculptures-Set-of-2-/206385828806',
      startTime: '2026-07-01T05:58:00.000Z'
    }],
    ['204825762798', {
      id: '206385828856',
      title: 'Vintage 1945 Noritake Harmony Fine China Sugar Bowl With Lid',
      url: 'https://www.ebay.com/itm/Vintage-1945-Noritake-Harmony-Fine-China-Sugar-Bowl-With-Lid-/206385828856',
      startTime: '2026-07-01T05:58:00.000Z'
    }]
  ]);

  function sharperEbayImageUrl(url) {
    if (!url || !/i\.ebayimg\.com/i.test(url)) return url;
    return String(url)
      .replace(/\/s-l\d+(?=\.(?:jpg|jpeg|png|webp)(?:[?#]|$))/i, '/s-l1000')
      .replace(/\/\$_\d+(?=\.(?:jpg|jpeg|png|webp)(?:[?#]|$))/i, '/$_57');
  }

  function sharpenItemImage(item) {
    if (!item || typeof item !== 'object') return item;
    const image = sharperEbayImageUrl(item.image);
    return image === item.image ? item : { ...item, image };
  }

  function canonicalItemId(item) {
    const id = String(item?.id || '');
    const match = id.match(/\d{12}/);
    return match ? match[0] : id;
  }

  function patchInventory(data) {
    if (!data || !Array.isArray(data.items)) return data;
    const seen = new Set();
    data.items = data.items
      .map(item => {
        const replacement = relistedItems.get(String(item.id || ''));
        const patched = replacement ? { ...item, ...replacement } : item;
        if (replacement) {
          delete patched.status;
          delete patched.soldAt;
          delete patched.soldReason;
        }
        return sharpenItemImage(patched);
      })
      .filter(item => {
        const id = canonicalItemId(item);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        item.id = id;
        return true;
      });
    return data;
  }

  function liveInventoryUrl() {
    const url = new URL('/.netlify/functions/ebay-listings', window.location.origin);
    url.searchParams.set('seller', 'jomagicbackpack');
    url.searchParams.set('limit', '50');
    url.searchParams.set('pages', '6');
    url.searchParams.set('sort', 'new');
    return url.toString();
  }

  function mergeLiveInventory(savedData, liveData) {
    const savedItems = Array.isArray(savedData?.items) ? patchInventory({ ...savedData, items: [...savedData.items] }).items : [];
    const liveItems = Array.isArray(liveData?.result?.items) ? liveData.result.items.map(sharpenItemImage) : [];
    if (!liveItems.length) return savedData;

    const savedById = new Map(savedItems.map(item => [canonicalItemId(item), item]));
    const merged = [];
    const seen = new Set();

    liveItems.forEach(liveItem => {
      const id = canonicalItemId(liveItem);
      if (!id || seen.has(id)) return;
      const savedItem = savedById.get(id) || {};
      const item = {
        ...savedItem,
        ...liveItem,
        id,
        categories: savedItem.categories || liveItem.categories || []
      };
      delete item.status;
      delete item.soldAt;
      delete item.soldReason;
      merged.push(item);
      seen.add(id);
    });

    savedItems.forEach(item => {
      const id = canonicalItemId(item);
      if (!id || seen.has(id)) return;
      item.id = id;
      merged.push(item);
      seen.add(id);
    });

    return { ...(savedData || {}), items: merged };
  }

  async function syncedInventoryResponse(input, init, response) {
    const savedData = await response.clone().json().then(patchInventory);
    let mergedData = savedData;
    try {
      const liveResponse = await originalFetch(liveInventoryUrl(), { cache: 'no-store' });
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        mergedData = mergeLiveInventory(savedData, liveData);
      }
    } catch (error) {
      mergedData = savedData;
    }

    return new Response(JSON.stringify(mergedData), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    if (/data\/inventory\.json(?:$|[?#])/.test(url)) {
      return originalFetch(input, init)
        .then(response => syncedInventoryResponse(input, init, response))
        .catch(() => originalFetch(input, init));
    }

    return originalFetch(input, init);
  };
})();
