import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleGetMasterPassword(
  request: Request,
  env: Env
): Promise<Response> {
  console.log("🔐 [get-masterpassword] route hit");

  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    console.error("❌ Missing or invalid Bearer token");
    return withCors(new Response("Missing or invalid token", { status: 401 }));
  }

  const token = auth.replace("Bearer ", "");
  let sub: string;
  try {
    const claims = await verifyJwt(token, env);
    sub = claims.sub;
    console.log("🧠 JWT verified. sub:", sub);
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return withCors(new Response("Invalid JWT", { status: 401 }));
  }

  try {
    console.log("💾 Fetching from R2 →", `${sub}/masterkey.enc, salt.bin, iv.bin`);
    const masterKeyObject = await env.R2.get(`${sub}/masterkey.enc`);
    const saltObject = await env.R2.get(`${sub}/salt.bin`);
    const ivObject = await env.R2.get(`${sub}/iv.bin`);

    if (!masterKeyObject || !saltObject || !ivObject) {
      console.error("❌ Master key, salt, or IV not found in R2");
      return withCors(
        new Response("Master key, salt, or IV not found", { status: 404 })
      );
    }

    const masterKey = await masterKeyObject.text();
    const salt = await saltObject.text();
    const iv = await ivObject.text();

    console.log("✅ Retrieved from R2. Returning JSON payload.");

    return withCors(
      new Response(
        JSON.stringify({ encryptedPassword: masterKey, salt, iv }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
  } catch (err) {
    console.error("❌ Failed to retrieve master key:", err);
    return withCors(new Response("Failed to retrieve master key", { status: 500 }));
  }
}
