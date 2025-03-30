import { handleUploadFile } from "./routes/uploadFile";
import { handleUploadManifest } from "./routes/uploadManifest";
import { handleGetManifest } from "./routes/getManifest";
import { handleGetFile } from "./routes/getFile";
import { handleStoreMasterKey } from "./routes/storeMasterKey";
import { handleRetrieveMasterKey } from "./routes/getMasterKey";
import { withCors } from "./utils/cors"; // ✅ Import your CORS wrapper
import { verifyJwt } from "./utils/authentication";
import { handleLogin } from "./routes/handleLogin";
import { handleRespondMFA } from "./routes/handleRespondMFA";
import { handleListFiles } from "./routes/listFiles";


export interface Env {
  R2: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log("🧪 DEBUG: env.R2 =", env.R2);

    const url = new URL(request.url);
    const method = request.method;

    // ✅ Global CORS preflight handler
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // ✅ Wrap each response with withCors()

    if (method === "POST" && url.pathname === "/api/login") {
      const res = await handleLogin(request, env); 
      return withCors(res);
    }
    
    if (method === "POST" && url.pathname === "/api/respondMFA") {
      const res = await handleRespondMFA(request, env); 
      return withCors(res);
    }
    

    if (method === "POST" && url.pathname === "/upload-file") {
      const res = await handleUploadFile(request, env);
      return withCors(res);
    }

    if (method === "POST" && url.pathname === "/upload-manifest") {
      const res = await handleUploadManifest(request, env);
      return withCors(res);
    }

    if (method === "POST" && url.pathname === "/api/store-masterkey") {
      const res = await handleStoreMasterKey(request, env);
      return withCors(res);
    }

    if (method === "GET" && url.pathname === "/api/retrieve-masterkey") {
      const res = await handleRetrieveMasterKey(request, env);
      return withCors(res);
    }

    if (method === "GET" && url.pathname === "/manifest") {
      const res = await handleGetManifest(request, env);
      return withCors(res);
    }

    if (method === "GET" && url.pathname === "/file") {
      const res = await handleGetFile(request, env);
      return withCors(res);
    }    

    if (method === "GET" && url.pathname === "/api/list") {
      const res = await handleListFiles(request, env);
      return withCors(res);
    }
    
    return withCors(new Response("Not Found", { status: 404 }));
  },
};
