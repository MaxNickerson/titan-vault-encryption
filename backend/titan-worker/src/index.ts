import { handleUploadFile } from "./routes/uploadFile";
import { handleUploadManifest } from "./routes/uploadManifest";
import { handleGetManifest } from "./routes/getManifest";
import { handleGetFile } from "./routes/getFile";
import { handleStoreMasterKey } from "./routes/storeMasterKey";
import { handleRetrieveMasterKey } from "./routes/getMasterKey";

export interface Env {
  R2: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log("🧪 DEBUG: env.R2 =", env.R2);

    const url = new URL(request.url);
    const method = request.method;

    if (method === "POST" && url.pathname === "/upload-file") {
      return handleUploadFile(request, env);
    }

    if (method === "POST" && url.pathname === "/upload-manifest") {
      return handleUploadManifest(request, env);
    }
    if (method === "POST" && url.pathname === "/api/store-masterkey") {
      return handleStoreMasterKey(request, env);
    }
    
    if (method === "GET" && url.pathname === "/api/retrieve-masterkey") {
      return handleRetrieveMasterKey(request, env);
    }

    if (method === "GET" && url.pathname === "/manifest") {
      return handleGetManifest(request, env);
    }
    

	if (method === "GET" && url.pathname.startsWith("/file/")) {
		const hash = url.pathname.split("/file/")[1];
		return handleGetFile(request, env, hash);
	}
	  
	if (url.pathname === "/list" && method === "GET") {
		const objects = await env.R2.list({ prefix: "test-user-123/" });
		console.log("🧾 R2 contents:", objects.objects);
		return new Response(JSON.stringify(objects.objects, null, 2), {
		  headers: { "Content-Type": "application/json" },
		});
	  }

    if (method === "POST" && url.pathname === "/api/store-masterkey") {
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
    
	  
    return new Response("Not Found", { status: 404 });
  },
};
