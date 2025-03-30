import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";
import { Env } from "../index";

export async function handleSetMasterPasswordFlag(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return withCors(new Response(JSON.stringify({ error: "Missing or invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }));
    }

    const token = authHeader.split(" ")[1];
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    const userPoolId = env.COGNITO_USER_POOL_ID;
    const region = env.COGNITO_REGION;

    const updateRes = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.AdminUpdateUserAttributes"
      },
      body: JSON.stringify({
        UserPoolId: userPoolId,
        Username: sub,
        UserAttributes: [
          {
            Name: "custom:hasMasterPassword",
            Value: "true"
          }
        ]
      })
    });

    const result = await updateRes.json();

    if (result?.errorMessage) {
      console.error("Cognito update error:", result);
      return withCors(new Response(JSON.stringify({ error: result.errorMessage }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }));
    }

    return withCors(new Response(JSON.stringify({
      message: "Master password attribute updated to true"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
  } catch (err: any) {
    console.error("Failed to update Cognito attribute:", err);
    return withCors(new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    }));
  }
}
