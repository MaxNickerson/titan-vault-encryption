import { verifyJwt } from "../utils/jwt";

export async function handleUploadManifest(request: Request, env: Env): Promise<Response> {
  try {
    // 1) Extract token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Missing or invalid token", { status: 401 });
    }
    const token = authHeader.substring("Bearer ".length);

    // 2) Verify & decode JWT
    const claims = await verifyJwt(token);
    const sub = claims.sub;
    if (!sub) {
      return new Response("Missing sub in token claims", { status: 400 });
    }

    // 3) Grab the raw body text
    //    The client’s body is something like:
    //    { "iv": "...", "encryptedData": "..." }
    //    We'll store that entire JSON in R2 as text.
    const bodyText = await request.text();
    if (!bodyText) {
      return new Response("Missing request body", { status: 400 });
    }

    // Optionally, you could parse & validate JSON:
    // const { iv, encryptedData } = JSON.parse(bodyText);
    // if (!iv || !encryptedData) {
    //   return new Response("Missing fields", { status: 400 });
    // }

    // 4) Put the JSON into R2
    await env.R2.put(`${sub}/manifest.json.enc`, bodyText, {
      httpMetadata: { contentType: "application/json" },
    });

    // 5) Return success
    return new Response("Manifest uploaded", { status: 200 });
  } catch (error) {
    console.error("Error in handleUploadManifest:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
