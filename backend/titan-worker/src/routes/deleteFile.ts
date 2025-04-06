// src/routes/deleteFile.ts
import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleDeleteFile(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    console.log("🗑️ [deleteFile] route hit");

    // 1) Verify JWT
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

    // 2) Parse request body to get the file hash
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      return withCors(new Response("Expected application/json body", { status: 400 }));
    }

    const body = await request.json().catch(() => null);
    const hash = body?.hash;

    if (!hash) {
      return withCors(new Response("Missing file hash in request", { status: 400 }));
    }

    // 3) Construct file key and delete from R2
    const r2Key = `${sub}/files/${hash}`;
    await env.R2.delete(r2Key);
    console.log(`✅ Deleted R2 object: ${r2Key}`);

    // 4) Return success
    return withCors(
      new Response(JSON.stringify({ success: true, deleted: hash }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
  } catch (err) {
    console.error("❌ handleDeleteFile error:", err);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
