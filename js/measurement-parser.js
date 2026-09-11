(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.JoMagicMeasurements = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const measurementNames = /(?:measurement|\b(length|width|height|depth|diameter|waist|inseam|outseam|rise|shoulder|sleeve|pit to pit|opening|overall|circumference|capacity|weight|chest|hem)\b)/i;
  const measurementValue = /(?:\b\d+(?:\.\d+)?\s*(?:in(?:ches)?\b|cm\b|mm\b|ft\b|feet\b|"|oz\b|lb\b|lbs\b|pounds?\b|ml\b|l\b|liters?\b|gal\b|gallons?\b|qt\b|quarts?\b)|\b\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?(?:\s*(?:x|×)\s*\d+(?:\.\d+)?)?\s*(?:in(?:ches)?|cm|mm|ft)\b)/i;
  const specificLabels = [
    'shoulder seam to sleeve end', 'shoulder seam to cuff', 'shoulder to shoulder', 'shoulder to cuff',
    'waist circumference', 'waist laid flat', 'opening diameter', 'armpit to armpit', 'pit to pit',
    'sleeve length', 'back length', 'front length', 'total length', 'garment length', 'chest width',
    'front rise', 'back rise', 'leg opening', 'hem width', 'outseam', 'inseam', 'diameter', 'shoulder',
    'sleeve', 'length', 'width', 'height', 'depth', 'waist', 'rise', 'chest', 'opening'
  ];
  const labelPattern = specificLabels.sort((left, right) => right.length - left.length).map(label => label.replace(/ /g, '\\s+')).join('|');
  const inlinePattern = new RegExp(`\\b(${labelPattern})\\b[^\\d]{0,45}(\\d+(?:\\.\\d+)?\\s*(?:in(?:ches)?|cm|mm|ft|feet|"))`, 'gi');

  function titleCase(label) { return label.replace(/^p2p$/i, 'Pit to pit').replace(/\b\w/g, character => character.toUpperCase()); }
  function isMeasurementRow(name, value) { return measurementNames.test(name) && measurementValue.test(value); }
  // One ordered matcher consumes a whole label and value, preventing suffix aliases.
  function inlineMeasurementRows(text) {
    const rows = [];
    String(text || '').split('\n').forEach(line => {
      inlinePattern.lastIndex = 0;
      let match;
      while ((match = inlinePattern.exec(line))) rows.push([titleCase(match[1]), match[2]]);
    });
    return rows;
  }
  return { measurementNames, measurementValue, inlinePattern, isMeasurementRow, inlineMeasurementRows };
}));
