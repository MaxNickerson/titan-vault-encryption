export function withCors(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return new Response(response.body, {
      ...response,
      headers: newHeaders,
    });
  }
  