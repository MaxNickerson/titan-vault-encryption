import { verifyJwt } from "../utils/jwt";

export async function handleGetFile(request: Request, env: Env, hash: string): Promise<Response> {
  try {
    const token = request.headers.get("Authorization")?.split(" ")[1];
    const claims = await verifyJwt(token);
    const sub = claims.sub;

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
    return new Response("Error downloading file", { status: 500 });
  }
}
