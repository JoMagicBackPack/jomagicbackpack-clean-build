const themeLink = '<link rel="stylesheet" href="/css/moonlight-theme.css?v=20260529a">';

export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (request.method !== "GET" || !contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const themedHtml = html.includes("moonlight-theme.css")
    ? html
    : html.replace("</head>", `  ${themeLink}\n</head>`);

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(themedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

export const config = {
  path: "/*"
};
