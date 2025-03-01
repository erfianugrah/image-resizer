// Main Worker entry point
import { handleImageRequest } from "./handlers/imageHandler";
import { getEnvironmentConfig } from "./config/environmentConfig";

// Global environment config that will be populated at runtime
let runtimeConfig = null;

export default {
  fetch: async (request, env, ctx) => {
    try {
      // Initialize the runtime config if not already done
      if (!runtimeConfig) {
        runtimeConfig = getEnvironmentConfig(env);
      }

      // Skip resizing for Cloudflare's own requests
      if (
        !/image-resizing/.test(request.headers.get("via")) &&
        !/undici/.test(request.headers.get("user-agent")) &&
        !/node/.test(request.headers.get("user-agent"))
      ) {
        return handleImageRequest(request, runtimeConfig);
      }

      return fetch(request); // pass-through and continue
    } catch (error) {
      console.error("Unexpected error in worker:", error);
      return new Response("An unexpected error occurred", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};
