import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleUploadManifest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    console.log("🗃 [uploadManifest] route hit");

    // 1) JWT check
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }
    const token = authHeader.substring("Bearer ".length);
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;
    if (!sub) {
      return withCors(new Response("Missing sub in token claims", { status: 400 }));
    }

    // 2) Read raw binary (the IV + encrypted manifest)
    const combinedBuffer = await request.arrayBuffer();
    console.log("🧾 Manifest size =", combinedBuffer.byteLength);

    // 3) Store it in R2 as a single file, e.g. `manifest.bin`
    const r2Key = `${sub}/manifest.bin`;
    await env.R2.put(r2Key, combinedBuffer, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    return withCors(new Response("Manifest uploaded", { status: 200 }));
  } catch (error) {
    console.error("Error in handleUploadManifest:", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
