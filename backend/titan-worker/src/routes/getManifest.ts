import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleGetManifest(request: Request, env: Env): Promise<Response> {
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

    const obj = await env.R2.get(`${sub}/manifest.json.enc`);
    if (!obj) {
      return withCors(new Response("Manifest not found", { status: 404 }));
    }

    const storedJson = await obj.text();

    return withCors(new Response(storedJson, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  } catch (error) {
    console.error("Error in handleGetManifest:", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
