import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleDeleteUser(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // 1) Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }

    const token = authHeader.substring("Bearer ".length);
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;
    if (!sub) {
      return withCors(new Response("Missing sub claim", { status: 400 }));
    }

    // 2) List+delete all objects under <sub>/...
    let listResult = await env.R2.list({ prefix: `${sub}/` });
    while (true) {
      for (const obj of listResult.objects) {
        await env.R2.delete(obj.key);
      }

      if (listResult.truncated && listResult.cursor) {
        listResult = await env.R2.list({
          prefix: `${sub}/`,
          cursor: listResult.cursor,
        });
      } else {
        break;
      }
    }

    // 3) Return success
    return withCors(
      new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      })
    );
  } catch (err) {
    console.error("❌ handleDeleteUser error:", err);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
