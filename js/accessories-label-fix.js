(() => {
  const replacements = new Map([
    ['Bags & Accessories', 'Accessories'],
    ['View all Bags & Accessories on eBay', 'View all Accessories on eBay']
  ]);

  function cleanAccessoriesLabel(root = document.body) {
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      let text = node.nodeValue;
      replacements.forEach((replacement, original) => {
        text = text.replaceAll(original, replacement);
      });
      node.nodeValue = text;
    });
  }

  function loadActiveCountFix() {
    if (document.querySelector('script[data-active-count-fix]')) return;
    const script = document.createElement('script');
    script.src = 'js/active-count-fix.js?v=20260617a';
    script.defer = true;
    script.dataset.activeCountFix = 'true';
    document.body.appendChild(script);
  }

  document.addEventListener('DOMContentLoaded', () => {
    cleanAccessoriesLabel();
    loadActiveCountFix();
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            replacements.forEach((replacement, original) => {
              node.nodeValue = node.nodeValue.replaceAll(original, replacement);
            });
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            cleanAccessoriesLabel(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
