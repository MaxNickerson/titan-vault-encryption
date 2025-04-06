import { handleUploadFile } from "./routes/uploadFile";
import { handleUploadManifest } from "./routes/uploadManifest";
import { handleGetManifest } from "./routes/getManifest";
import { handleGetFile } from "./routes/getFile";
import { handleStoreMasterPassword } from "./routes/storeMasterPassword";
import { handleGetMasterPassword } from "./routes/getMasterPassword";
import { withCors } from "./utils/cors";
import { verifyJwt } from "./utils/authentication";
import { handleLogin } from "./routes/handleLogin";
import { handleRespondMFA } from "./routes/handleRespondMFA";
import { handleListFiles } from "./routes/listFiles";
import { handleDeleteUser } from "./routes/deleteUser";
import { handleDeleteFile } from "./routes/deleteFile";




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
          "Access-Control-Allow-Origin": "https://titan-vault-frontend.pages.dev",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-File-Name, x-file-name",
        },
      });
    }

    // ✅ Auth & Session
    if (method === "POST" && url.pathname === "/api/login") {
      return withCors(await handleLogin(request, env));
    }

    if (method === "POST" && url.pathname === "/api/respondMFA") {
      return withCors(await handleRespondMFA(request, env));
    }

    // ✅ Upload / Download / Manifest
    if (method === "POST" && url.pathname === "/api/upload-file") {
      return withCors(await handleUploadFile(request, env));
    }

    if (method === "POST" && url.pathname === "/api/upload-manifest") {
      return withCors(await handleUploadManifest(request, env));
    }

    if (method === "GET" && url.pathname === "/api/manifest") {
      return withCors(await handleGetManifest(request, env));
    }

    if (method === "GET" && url.pathname === "/api/file") {
      return withCors(await handleGetFile(request, env));
    }

    if (method === "POST" && url.pathname === "/api/store-masterpassword") {
      return withCors(await handleStoreMasterPassword(request, env));
    }

    if (method === "GET" && url.pathname === "/api/get-masterpassword") {
      return withCors(await handleGetMasterPassword(request, env));
    }

    // ✅ List R2 contents (optional admin/debug)
    if (method === "GET" && url.pathname === "/api/list") {
      return withCors(await handleListFiles(request, env));
    }

    if (method === "DELETE" && url.pathname === "/api/delete-userdata") {
      return withCors(await handleDeleteUser(request, env));
    }

    if (method === "DELETE" && url.pathname === "/api/delete-file") {
      return withCors(await handleDeleteFile(request, env));
    }
    

    // ✅ Fallback route
    return withCors(new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }));
  },
};
