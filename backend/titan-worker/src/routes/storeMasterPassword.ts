import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleStoreMasterPassword(
  request: Request,
  env: Env
): Promise<Response> {
  console.log("🔐 [store-masterpassword] route hit");

  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "");
  if (!token) {
    console.error("❌ No Bearer token provided");
    return withCors(new Response("Missing or invalid token", { status: 401 }));
  }

  console.log("🧾 Received token:", token.slice(0, 20), "...");

  let sub: string;
  try {
    const claims = await verifyJwt(token, env);
    sub = claims.sub;
    console.log("🧠 JWT verified. sub:", sub);
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return withCors(new Response("Invalid JWT", { status: 401 }));
  }

  let body: any;
  try {
    body = await request.json();
    console.log("📦 Body parsed:", JSON.stringify(body, null, 2));
  } catch {
    console.error("❌ Could not parse JSON body");
    return withCors(new Response("Invalid JSON", { status: 400 }));
  }

  const { encryptedPassword, salt, iv } = body;

  if (!encryptedPassword || !salt || !iv) {
    console.error(
      "❌ Missing one or more required fields: encryptedPassword, salt, iv"
    );
    return withCors(
      new Response("Missing encryptedPassword, salt, or iv", { status: 400 })
    );
  }

  try {
    console.log(`💾 Writing to R2: ${sub}/masterkey.enc, salt.bin, iv.bin`);
    await env.R2.put(`${sub}/masterkey.enc`, encryptedPassword);
    await env.R2.put(`${sub}/salt.bin`, salt);
    await env.R2.put(`${sub}/iv.bin`, iv);
    console.log("✅ R2 storage complete");
  } catch (err) {
    console.error("❌ R2 write failed:", err);
    return withCors(new Response("Failed to store master key", { status: 500 }));
  }

  // === Optionally call your Lambda to update the Cognito flag ===
  try {
    console.log("📞 Calling Lambda to update Cognito flag...");
    const lambdaResp = await fetch(
      "https://4wevk3gjens6nwnp3gnqfap6wa0bxzfr.lambda-url.us-east-1.on.aws/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub }),
      }
    );

    const lambdaText = await lambdaResp.text();
    console.log("🧾 Lambda response:", lambdaText);

    if (!lambdaResp.ok) {
      return withCors(new Response("Lambda failed: " + lambdaText, { status: 500 }));
    }
  } catch (err) {
    console.error("❌ Lambda call failed:", err);
    return withCors(new Response("Failed to call Lambda", { status: 500 }));
  }

  return withCors(
    new Response(
      JSON.stringify({ message: "Master password stored and Cognito flag set" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  );
}
