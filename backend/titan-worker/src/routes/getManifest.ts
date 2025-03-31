import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleGetManifest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    console.log("🗃 [getManifest] route hit");

    // 1) JWT check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }
    const token = authHeader.replace("Bearer ", "");
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;
    if (!sub) {
      return withCors(new Response("Missing sub in token claims", { status: 400 }));
    }

    // 2) Pull the single .bin file
    const r2Key = `${sub}/manifest.bin`;
    const obj = await env.R2.get(r2Key);
    if (!obj) {
      return withCors(new Response("Manifest not found", { status: 404 }));
    }

    // 3) Return raw binary (IV + ciphertext) directly
    const manifestBinary = await obj.arrayBuffer();

    return withCors(new Response(manifestBinary, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    }));
  } catch (error) {
    console.error("Error in handleGetManifest:", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
