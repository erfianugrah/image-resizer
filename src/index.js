// Main Worker entry point
import { handleImageRequest } from "./handlers/imageHandler.js";
import { getEnvironmentConfig } from "./config/environmentConfig.js";

// Global environment config that will be populated at runtime
let runtimeConfig = null;

export default {
  fetch: async (request, env, ctx) => {
    try {
      // Initialize the runtime config if not already done
      if (!runtimeConfig) {
        runtimeConfig = getEnvironmentConfig(env);
      }

      // Define patterns to skip resizing
      const skipPatterns = [
        (headers) => /image-resizing/.test(headers.get("via") || ""),
        (headers) => /undici/.test(headers.get("user-agent") || ""),
        (headers) => /node/.test(headers.get("user-agent") || ""),
      ];

      // Check if we should skip resizing
      const shouldSkip = skipPatterns.some((pattern) =>
        pattern(request.headers)
      );

      if (!shouldSkip) {
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
