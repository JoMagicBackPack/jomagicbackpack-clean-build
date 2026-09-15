/**
 * Receives eBay fixed-price transaction notifications and immediately updates
 * the private JoMagic Drive pull queue. No buyer information is retained.
 * Credentials are supplied only through Netlify runtime configuration.
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const EBAY_SCOPE = "https://api.ebay.com/oauth/api_scope";
const DRIVE_FOLDER_ID = process.env.JMB_DRIVE_INVENTORY_FOLDER_ID;
const STORAGE_REGISTRY_FILE_ID = process.env.JMB_STORAGE_REGISTRY_FILE_ID;
const WEBHOOK_TOKEN = process.env.JMB_EBAY_WEBHOOK_TOKEN;

const xmlValue = (xml, name) => {
  const match = new RegExp("<(?:\\w+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?" + name + ">", "i").exec(xml || "");
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : "";
};

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); if (row.some(value => value !== "")) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(value => value !== "")) rows.push(row);
  const [headers = [], ...values] = rows;
  return values.map(line => Object.fromEntries(headers.map((header, index) => [header, line[index] || ""])));
}
function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
function csvText(headers, rows) {
  return [headers.join(","), ...rows.map(row => headers.map(header => csvEscape(row[header])).join(","))].join("\n") + "\n";
}
function queueText(rows) {
  const open = rows.filter(row => String(row.queue_status || "OPEN").toUpperCase() === "OPEN");
  if (!open.length) return "SOLD ITEMS TO PULL\n\nNo sold items are currently waiting to be pulled.\n";
  return "SOLD ITEMS TO PULL\n\n" + open.map(row =>
    "SOLD: " + row.title + "\nSKU: " + row.sku + "\n" + row.pull_instruction +
    "\nOrder: " + row.order_id + " | Qty: " + row.quantity
  ).join("\n\n") + "\n";
}
async function ebayAccessToken() {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET, refresh = process.env.EBAY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error("Missing eBay seller authorization.");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh, scope: EBAY_SCOPE })
  });
  if (!response.ok) throw new Error("eBay authorization refresh failed.");
  return (await response.json()).access_token;
}
async function ebayItem(itemId) {
  if (!itemId) return {};
  const token = await ebayAccessToken();
  const request = '<?xml version="1.0" encoding="utf-8"?><GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents"><ItemID>' + itemId + '</ItemID><DetailLevel>ReturnAll</DetailLevel><IncludeItemSpecifics>true</IncludeItemSpecifics><Version>1477</Version></GetItemRequest>';
  const response = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: { "Content-Type": "text/xml", "X-EBAY-API-CALL-NAME": "GetItem", "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "1477", "X-EBAY-API-IAF-TOKEN": token },
    body: request
  });
  if (!response.ok) throw new Error("eBay item lookup failed.");
  const xml = await response.text();
  return { sku: xmlValue(xml, "SKU"), title: xmlValue(xml, "Title") };
}
async function driveToken() {
  const id = process.env.GOOGLE_DRIVE_CLIENT_ID, secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET, refresh = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error("Missing Google Drive authorization.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" })
  });
  if (!response.ok) throw new Error("Google Drive authorization refresh failed.");
  return (await response.json()).access_token;
}
async function driveFetch(token, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: "Bearer " + token, ...(options.headers || {}) } });
  if (!response.ok) throw new Error("Drive request failed (" + response.status + ").");
  return response;
}
async function findDriveFile(token, name) {
  const query = "'" + DRIVE_FOLDER_ID + "' in parents and name = '" + name.replace(/'/g, "\\'") + "' and trashed = false";
  const response = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name)");
  const files = (await response.json()).files || [];
  if (files.length > 1) throw new Error("Ambiguous Drive pull-queue file.");
  return files[0] || null;
}
async function readDriveFile(token, id) {
  return (await driveFetch(token, "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(id) + "?alt=media")).text();
}
async function upsertDriveText(token, name, text) {
  const existing = await findDriveFile(token, name);
  if (existing) {
    await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files/" + encodeURIComponent(existing.id) + "?uploadType=media", {
      method: "PATCH", headers: { "Content-Type": name.endsWith(".csv") ? "text/csv" : "text/plain" }, body: text
    });
    return;
  }
  const boundary = "jomagic-" + Math.random().toString(16).slice(2);
  const body = "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify({ name, parents: [DRIVE_FOLDER_ID] }) + "\r\n--" + boundary + "\r\nContent-Type: " +
    (name.endsWith(".csv") ? "text/csv" : "text/plain") + "\r\n\r\n" + text + "\r\n--" + boundary + "--";
  await driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + boundary }, body
  });
}
exports.handler = async (event) => {
  if (!WEBHOOK_TOKEN || event.queryStringParameters?.key !== WEBHOOK_TOKEN) return { statusCode: 404, body: "" };
  if (event.httpMethod === "GET") return { statusCode: 200, body: "JoMagic eBay sale receiver ready." };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };
  try {
    const payload = event.body || "";
    const eventType = xmlValue(payload, "EventType");
    if (eventType && eventType !== "FixedPriceTransaction") return { statusCode: 200, body: "" };
    const itemId = xmlValue(payload, "ItemID");
    const item = await ebayItem(itemId);
    const sku = item.sku || xmlValue(payload, "SKU");
    if (!sku) throw new Error("Sale notification did not resolve to a SKU.");
    const token = await driveToken();
    const registry = parseCsv(await readDriveFile(token, STORAGE_REGISTRY_FILE_ID));
    const matches = registry.filter(row => row.sku === sku);
    const storage = matches.length === 1 ? matches[0] : {};
    const lineId = xmlValue(payload, "OrderLineItemID") || [xmlValue(payload, "OrderID"), itemId, xmlValue(payload, "TransactionID")].filter(Boolean).join("-");
    if (!lineId) throw new Error("Sale notification did not include an order identity.");
    const headers = ["order_line_item_id","sale_date","order_id","listing_id","sku","title","quantity","storage_bin","storage_status","queue_status","pull_instruction"];
    const existing = await findDriveFile(token, "Sold Items To Pull.csv");
    const rows = existing ? parseCsv(await readDriveFile(token, existing.id)) : [];
    if (!rows.some(row => row.order_line_item_id === lineId)) rows.push({
      order_line_item_id: lineId, sale_date: new Date().toISOString().slice(0, 10),
      order_id: xmlValue(payload, "OrderID"), listing_id: itemId, sku,
      title: item.title || xmlValue(payload, "Title") || "eBay sold item",
      quantity: xmlValue(payload, "QuantityPurchased") || "1", storage_bin: storage.storage_bin || "",
      storage_status: storage.status || "", queue_status: "OPEN",
      pull_instruction: storage.storage_bin ? "Pull from " + storage.storage_bin : "Storage bin needs review before pulling"
    });
    await upsertDriveText(token, "Sold Items To Pull.csv", csvText(headers, rows));
    await upsertDriveText(token, "Sold Items To Pull.txt", queueText(rows));
    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error("JoMagic sale receiver failed:", error.message);
    return { statusCode: 500, body: "" };
  }
};