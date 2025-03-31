import { verifyJwt } from "../utils/authentication"; // ✅ Use your Cognito JWT verifier

export async function handleGetFile(request: Request, env: Env): Promise<Response> {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return new Response("Missing Authorization token", { status: 401 });
    }

    const claims = await verifyJwt(token, env); // ✅ Pass env here
    const sub = claims.sub;

    const url = new URL(request.url);
    const hash = url.searchParams.get("hash");

    if (!hash) {
      return new Response("Missing file hash", { status: 400 });
    }

    const objectKey = `${sub}/${hash}`;
    const obj = await env.R2.get(objectKey);

    if (!obj) {
      return new Response("File not found", { status: 404 });
    }

    return new Response(obj.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${hash}"`,
      },
    });
  } catch (err) {
    console.error("Error downloading file:", err);
    return new Response("Error downloading file", { status: 500 });
  }
}
