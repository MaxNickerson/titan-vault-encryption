import { verifyJwt } from "../utils/authentication";

export async function handleStoreMasterKey(request: Request, env: Env): Promise<Response> {
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

  if (!sub) {
    return new Response("Missing sub in token", { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { encryptedMasterKey, salt } = body;

  if (!encryptedMasterKey || !salt) {
    return new Response("Missing encryptedMasterKey or salt", { status: 400 });
  }

  try {
    await env.R2.put(`${sub}/masterkey.enc`, encryptedMasterKey);
    await env.R2.put(`${sub}/salt.bin`, salt);
  } catch (err) {
    console.error("Failed to write to R2:", err);
    return new Response("Failed to store master key", { status: 500 });
  }

  return new Response(
    JSON.stringify({
      message: "Master password stored successfully.",
      sub,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
