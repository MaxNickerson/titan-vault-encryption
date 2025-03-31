import { verifyJwt } from "../utils/authentication";

export async function handleRetrieveMasterKey(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response("Missing or invalid token", { status: 401 });
  }

  const token = auth.replace("Bearer ", "");
  let sub: string;

  try {
    const claims = await verifyJwt(token, env);
    sub = claims.sub;
  } catch {
    return new Response("Invalid JWT", { status: 401 });
  }

  try {
    const masterKeyObject = await env.R2.get(`${sub}/masterkey.enc`);
    const saltObject = await env.R2.get(`${sub}/salt.bin`);

    if (!masterKeyObject || !saltObject) {
      return new Response("Master key or salt not found", { status: 404 });
    }

    const masterKey = await masterKeyObject.text();
    const salt = await saltObject.text();

    return new Response(
      JSON.stringify({ encryptedMasterKey: masterKey, salt }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response("Failed to retrieve master key", { status: 500 });
  }
}
