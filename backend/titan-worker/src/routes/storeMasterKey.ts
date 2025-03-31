export async function handleStoreMasterKey(request: Request, env: Env): Promise<Response> {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return new Response("Missing or invalid token", { status: 401 });
    }
  
    const token = auth.replace("Bearer ", "");
  
    let sub: string;
    try {
      const parts = token.split(".");
      const payload = JSON.parse(atob(parts[1]));
      sub = payload.sub;
    } catch {
      return new Response("Invalid JWT", { status: 401 });
    }
  
    if (!sub) {
      return new Response("Missing sub in token", { status: 400 });
    }
  
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
  
    const { encryptedMasterKey, salt } = body;
  
    if (!encryptedMasterKey || !salt) {
      return new Response("Missing encryptedMasterKey or salt", { status: 400 });
    }
  
    await env.R2.put(`${sub}/masterkey.enc`, encryptedMasterKey);
    await env.R2.put(`${sub}/salt.bin`, salt);
  
    return new Response(
      JSON.stringify({
        message: "Master password stored successfully.",
        sub,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
  