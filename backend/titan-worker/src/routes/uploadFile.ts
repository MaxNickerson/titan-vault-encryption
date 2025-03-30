import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function handleUploadFile(request: Request, env: Env): Promise<Response> {
  try {
    console.log("📦 Upload route hit");

    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return withCors(new Response("Missing Authorization token", { status: 401 }));
    }

    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    const { hash, encryptedData } = await request.json();
    console.log("📄 Body parsed:", { hash, encryptedData });
    console.log("🧪 Writing to:", `${sub}/${hash}`);

    const binaryData = base64ToArrayBuffer(encryptedData);

    await env.R2.put(`${sub}/${hash}`, binaryData, {
      httpMetadata: { contentType: "application/octet-stream" },
    });

    console.log("✅ Stored:", `${sub}/${hash}`);
    return withCors(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  } catch (err) {
    console.error("🔥 Upload failed:", err);
    return withCors(new Response("Upload failed: " + (err as Error).message, { status: 500 }));
  }
}
