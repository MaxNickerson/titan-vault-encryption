import { jwtVerify, createRemoteJWKSet } from "jose";


export async function verifyJwt(token: string, env: Env): Promise<any> {
  if (!token) throw new Error("No token provided");

  const region = env.COGNITO_REGION;
  const userPoolId = env.COGNITO_USER_POOL_ID;
  const clientId = env.COGNITO_CLIENT_ID;
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  console.log("🔐 Verifying JWT...");
  console.log("🔹 Region:", region);
  console.log("🔹 UserPoolId:", userPoolId);
  console.log("🔹 ClientId:", clientId);
  console.log("🔹 Issuer:", issuer);

  const JWKS = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      //audience: clientId,
    });

    console.log("✅ JWT verified. Payload:", payload);

    if (!payload.email_verified) {
      throw new Error("Email not verified");
    }

    return payload;
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    throw err;
  }
}
