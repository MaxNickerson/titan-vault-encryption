import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleStoreMasterKey(request: Request, env: Env): Promise<Response> {
  console.log("🔐 [store-masterkey] route hit");

  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "");
  console.log("🧾 Received token:", token?.slice(0, 20), "...");

  let sub: string;
  try {
    const claims = await verifyJwt(token, env);
    sub = claims.sub;
    console.log("🧠 JWT verified. Sub:", sub);
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return withCors(new Response("Invalid JWT", { status: 401 }));
  }

  let body;
  try {
    body = await request.json();
    console.log("📦 Body parsed:", body);
  } catch {
    return withCors(new Response("Invalid JSON", { status: 400 }));
  }

  const { encryptedMasterKey, salt } = body;
  if (!encryptedMasterKey || !salt) {
    return withCors(new Response("Missing encryptedMasterKey or salt", { status: 400 }));
  }

  try {
    console.log(`💾 Writing to R2 → ${sub}/masterkey.enc`);
    await env.R2.put(`${sub}/masterkey.enc`, encryptedMasterKey);
    await env.R2.put(`${sub}/salt.bin`, salt);
    console.log("✅ R2 storage complete");
  } catch (err) {
    console.error("❌ R2 write failed:", err);
    return withCors(new Response("Failed to store master key", { status: 500 }));
  }

  // 🧠 Lambda call
  try {
    console.log("📞 Calling Lambda to update Cognito flag...");
    const lambdaResp = await fetch("https://4wevk3gjens6nwnp3gnqfap6wa0bxzfr.lambda-url.us-east-1.on.aws/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub }),
    });

    const lambdaText = await lambdaResp.text();
    console.log("🧾 Lambda response:", lambdaText);

    if (!lambdaResp.ok) {
      return withCors(new Response("Lambda failed: " + lambdaText, { status: 500 }));
    }
  } catch (err) {
    console.error("❌ Lambda call failed:", err);
    return withCors(new Response("Failed to call Lambda", { status: 500 }));
  }

  return withCors(new Response(
    JSON.stringify({ message: "Master password stored and Cognito flag set" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  ));
}

