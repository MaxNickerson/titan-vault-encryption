import { verifyJwt } from "../utils/authentication";
import { withCors } from "../utils/cors";

export async function handleListFiles(request: Request, env: Env): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return withCors(new Response("Missing or invalid token", { status: 401 }));
    }

    const token = authHeader.substring("Bearer ".length);
    const claims = await verifyJwt(token, env);
    const sub = claims.sub;

    const objects = await env.R2.list({ prefix: `${sub}/` });

    return withCors(
      new Response(JSON.stringify(objects.objects, null, 2), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (err) {
    console.error("Failed to list user files:", err);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
}
