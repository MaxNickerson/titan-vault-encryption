export function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Access-Control-Allow-Origin", "https://titan-vault-frontend.pages.dev");
  newHeaders.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  // IMPORTANT: add X-File-Name
  newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-File-Name, x-file-name");
  return new Response(response.body, {
    ...response,
    headers: newHeaders,
  });
}
