import { withCors } from "../utils/cors";
import { Env } from "../index";

export async function handleRespondMFA(request: Request, env: Env): Promise<Response> {
  try {
    const { session, mfaCode, email } = await request.json();

    if (!session || !mfaCode || !email) {
      return withCors(new Response(JSON.stringify({ error: "Missing MFA input fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }));
    }

    const clientId = env.COGNITO_CLIENT_ID;
    const region = env.COGNITO_REGION;

    const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
      },
      body: JSON.stringify({
        ChallengeName: "SMS_MFA",
        ClientId: clientId,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          SMS_MFA_CODE: mfaCode,
        },
      }),
    });

    const result = await res.json();

    if (!result.AuthenticationResult) {
      return withCors(new Response(JSON.stringify({ error: "MFA failed: no tokens returned" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }));
    }

    return withCors(new Response(JSON.stringify(result.AuthenticationResult), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

  } catch (err) {
    console.error("RespondMFA error:", err);
    return withCors(new Response(JSON.stringify({ error: "MFA handling error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));
  }
}
