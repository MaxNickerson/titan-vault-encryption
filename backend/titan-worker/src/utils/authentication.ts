import { jwtVerify, createRemoteJWKSet } from 'jose';

export async function verifyJwt(token: string, env: Env): Promise<any> {
  if (!token) throw new Error("No token provided");

  const region = env.COGNITO_REGION;
  const userPoolId = env.COGNITO_USER_POOL_ID;
  const clientId = env.COGNITO_CLIENT_ID;
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  // Fetch and cache JWKS (Cloudflare will keep this warm)
  const JWKS = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  // Verify and decode token
  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience: clientId,
  });

  if (!payload.email_verified) {
    throw new Error("Email not verified");
  }

  return payload; // includes sub, email, exp, etc.
}
