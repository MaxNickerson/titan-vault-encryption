import { withCors } from "../utils/cors";
import { Env } from "../index";

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return withCors(new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }));
    }

    const userPoolId = env.COGNITO_USER_POOL_ID;
    const clientId = env.COGNITO_CLIENT_ID;
    const region = env.COGNITO_REGION;

    const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    });

    const result = await res.json();

    if (result.__type || result.message || result.error) {
      console.warn("⚠️ Cognito responded with error:", result);
      return withCors(new Response(JSON.stringify({ error: result.message || result.__type || "Unknown Cognito error" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }));
    }

    if (result.ChallengeName === "SMS_MFA") {
      return withCors(new Response(JSON.stringify({
        ChallengeName: result.ChallengeName,
        Session: result.Session,
        Message: "MFA required. Submit code to /respondMFA"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }

    if (!result.AuthenticationResult) {
      return withCors(new Response(JSON.stringify({ error: "Authentication failed: no tokens returned" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }));
    }

    return withCors(new Response(JSON.stringify(result.AuthenticationResult), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  } catch (err: any) {
    console.error("🔥 Uncaught login error:", err);
    return withCors(new Response(JSON.stringify({ error: err?.message || "Unhandled login error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));
  }
}
