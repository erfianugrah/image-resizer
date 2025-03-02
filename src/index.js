// Main Worker entry point
import { handleImageRequest } from "./handlers/imageHandler.js";
import { getEnvironmentConfig } from "./config/environmentConfig.js";
import {
  configureLogger,
  error,
  info,
  logRequest,
  setLogLevel,
} from "./utils/loggerUtils.js";
import {
  configureDebugHeaders,
  setDebugHeadersEnabled,
} from "./utils/debugHeadersUtils.js";

// Global environment config that will be populated at runtime
let runtimeConfig = null;

export default {
  fetch: async (request, env, ctx) => {
    try {
      // Initialize the runtime config if not already done
      if (!runtimeConfig) {
        runtimeConfig = getEnvironmentConfig(env);

        // Initialize logging based on environment config
        initializeLogging(runtimeConfig);

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

/**
 * Initialize logging based on configuration
 * @param {Object} config - Environment configuration
 */
function initializeLogging(config) {
  // Configure basic logger settings
  configureLogger({
    includeTimestamp: config.logging?.includeTimestamp !== false,
    enableStructuredLogs: config.logging?.enableStructuredLogs !== false,
    enableConsoleLogs: true,
  });

  // Set the log level separately - convert string level to numeric if needed
  if (config.logging?.level) {
    setLogLevel(config.logging.level);
  }

  // Configure debug headers
  const isDebugEnvironment = config.debugHeaders?.allowedEnvironments?.includes(
    config.ENVIRONMENT,
  );
  const enableDebugHeaders = config.debugHeaders?.enabled !== false &&
    isDebugEnvironment;

  setDebugHeadersEnabled(enableDebugHeaders);

  configureDebugHeaders({
    prefix: config.debugHeaders?.prefix || "debug-",
    includeHeaders: config.debugHeaders?.includeHeaders || [
      "ir",
      "cache",
      "mode",
      "client-hints",
      "ua",
    ],
  });
}
