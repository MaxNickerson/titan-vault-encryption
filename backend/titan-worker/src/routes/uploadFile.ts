import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleUploadFile(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    console.log("📦 [uploadFile] route hit");

    // 1) Verify JWT
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }
    const token = authHeader.replace("Bearer ", "");
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    // 2) Extract the `hash` from the x-file-name header
    const hash = request.headers.get("X-file-name");
    if (!hash) {
      return withCors(new Response("Missing X-file-name header", { status: 400 }));
    }

    // 3) Read the raw binary from the request
    const fileBuffer = await request.arrayBuffer(); // The IV+encrypted file from the front end

    // 4) Write it to R2
    const r2Key = `${sub}/${hash}`;
    console.log("🧪 Storing to R2:", r2Key, "size =", fileBuffer.byteLength);

    await env.R2.put(r2Key, fileBuffer, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    console.log("✅ Stored file in R2:", r2Key);
    return withCors(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (err) {
    console.error("🔥 Upload failed:", err);
    return withCors(
      new Response("Upload failed: " + (err as Error).message, { status: 500 })
    );
  }
}
