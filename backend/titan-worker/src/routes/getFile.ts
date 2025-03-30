import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleGetFile(request: Request, env: Env): Promise<Response> {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return withCors(new Response("Missing Authorization token", { status: 401 }));
    }

    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    const url = new URL(request.url);
    const hash = url.searchParams.get("hash");

    if (!hash) {
      return withCors(new Response("Missing file hash", { status: 400 }));
    }

    const objectKey = `${sub}/${hash}`;
    const obj = await env.R2.get(objectKey);

    if (!obj) {
      return withCors(new Response("File not found", { status: 404 }));
    }

    return withCors(new Response(obj.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${hash}"`,
      },
    }));
  } catch (err) {
    console.error("Error downloading file:", err);
    return withCors(new Response("Error downloading file", { status: 500 }));
  }
}
