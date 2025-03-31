import { verifyJwt } from "../utils/jwt";

export async function handleGetManifest(request: Request, env: Env): Promise<Response> {
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

    // 3) Attempt to read from R2
    const obj = await env.R2.get(`${sub}/manifest.json.enc`);
    if (!obj) {
      // If there's no manifest yet, return 404 so the client can handle creation
      return new Response("Manifest not found", { status: 404 });
    }

    // 4) We stored the entire manifest as JSON text
    const storedJson = await obj.text();

    // 5) Return that JSON
    return new Response(storedJson, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in handleGetManifest:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
