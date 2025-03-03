// Main Worker entry point
import { handleImageRequest } from "./handlers/imageHandler.js";
import { getEnvironmentConfig } from "./config/environmentConfig.js";
import { initializeLogging } from "./utils/loggingManager.js";
import { error, info, logRequest } from "./utils/loggerUtils.js";

// Global environment config that will be populated at runtime
let runtimeConfig = null;

export default {
  fetch: async (request, env, ctx) => {
    try {
      // Initialize the runtime config if not already done
      if (!runtimeConfig) {
        runtimeConfig = getEnvironmentConfig(env);

        // Initialize logging using our centralized manager
        initializeLogging(env);

        info(
          "Worker",
          `Initialized image-resizer v${
            env.VERSION || "1.0.0"
          } in ${runtimeConfig.deploymentMode} mode`,
        );
      }

      // Log incoming request at debug level
      logRequest("Request", request);

      // Define patterns to skip resizing
      const skipPatterns = [
        (headers) => /image-resizing/.test(headers.get("via") || ""),
        // (headers) => /undici/.test(headers.get("user-agent") || ""),
        // (headers) => /node/.test(headers.get("user-agent") || ""),
      ];

      // Check if we should skip resizing
      const shouldSkip = skipPatterns.some((pattern) =>
        pattern(request.headers)
      );

      if (!shouldSkip) {
        return handleImageRequest(request, runtimeConfig);
      }

      info("Worker", "Skipping image processing, passing through request");
      return fetch(request); // pass-through and continue
    } catch (err) {
      error("Worker", "Unexpected error in worker", {
        error: err.message,
        stack: err.stack,
      });

      return new Response("An unexpected error occurred", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};
