import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleUploadManifest(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }

    const token = authHeader.substring("Bearer ".length);
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    if (!sub) {
      return withCors(new Response("Missing sub in token claims", { status: 400 }));
    }

    const bodyText = await request.text();
    if (!bodyText) {
      return withCors(new Response("Missing request body", { status: 400 }));
    }

    await env.R2.put(`${sub}/manifest.json.enc`, bodyText, {
      httpMetadata: { contentType: "application/json" },
    });

    return withCors(new Response("Manifest uploaded", { status: 200 }));
  } catch (error) {
    console.error("Error in handleUploadManifest:", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
