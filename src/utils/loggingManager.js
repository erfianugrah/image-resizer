// Centralized manager for logging and debug headers configuration
import {
  configureLogger,
  debug,
  info,
  setLogLevel,
  warn,
} from "./loggerUtils.js";
import {
  configureDebugHeaders,
  setDebugHeadersEnabled,
} from "./debugHeadersUtils.js";

/**
 * Initialize all logging components from environment config
 * @param {Object} env - Environment variables from wrangler.toml
 * @returns {Object} - Initialized logging configuration
 */
export function initializeLogging(env) {
  // Parse logging configuration from environment
  const loggingConfig = parseLoggingConfig(env);

  // Configure regular logging first so we can use it for debug messages
  configureBasicLogging(loggingConfig);

  // Configure debug headers
  configureDebugHeadersLogging(loggingConfig, env);

  // Log initialization
  info("Logging", `Initialized logging with level: ${loggingConfig.level}`);
  debug("Logging", "Full logging configuration", loggingConfig);

  return loggingConfig;
}

/**
 * Parse logging configuration from environment variables
 * @param {Object} env - Environment variables
 * @returns {Object} - Parsed logging configuration
 */
function parseLoggingConfig(env) {
  // Default configuration
  const defaultConfig = {
    level: "INFO",
    includeTimestamp: true,
    enableStructuredLogs: true,
    debugHeaders: {
      enabled: true,
      prefix: "debug-",
      includeHeaders: ["ir", "cache", "mode", "client-hints", "ua"],
    },
  };

  // Try to parse LOGGING_CONFIG if present
  let loggingConfig = { ...defaultConfig };

  if (env.LOGGING_CONFIG) {
    try {
      const parsed = JSON.parse(env.LOGGING_CONFIG);
      loggingConfig = { ...loggingConfig, ...parsed };
    } catch (err) {
      warn("Config", "Failed to parse LOGGING_CONFIG", { error: err.message });
    }
  }

  // Try to parse DEBUG_HEADERS_CONFIG if present
  if (env.DEBUG_HEADERS_CONFIG) {
    try {
      const parsed = JSON.parse(env.DEBUG_HEADERS_CONFIG);
      loggingConfig.debugHeaders = {
        ...loggingConfig.debugHeaders,
        ...parsed,
      };
    } catch (err) {
      warn("Config", "Failed to parse DEBUG_HEADERS_CONFIG", {
        error: err.message,
      });
    }
  }

  return loggingConfig;
}

/**
 * Configure basic logging based on configuration
 * @param {Object} config - Logging configuration
 */
function configureBasicLogging(config) {
  // Configure basic logger settings
  configureLogger({
    includeTimestamp: config.includeTimestamp !== false,
    enableStructuredLogs: config.enableStructuredLogs !== false,
    enableConsoleLogs: true,
  });

  // Set the log level separately
  if (config.level) {
    setLogLevel(config.level);
  }
}

/**
 * Configure debug headers based on configuration
 * @param {Object} config - Logging configuration
 * @param {Object} env - Environment variables (for ENVIRONMENT check)
 */
function configureDebugHeadersLogging(config, env) {
  // Determine if debug headers should be enabled
  let enableDebugHeaders = config.debugHeaders?.enabled !== false;

  // Apply environment filtering if configured
  if (config.debugHeaders?.allowedEnvironments && env.ENVIRONMENT) {
    const isAllowedEnvironment = config.debugHeaders.allowedEnvironments
      .includes(env.ENVIRONMENT);
    enableDebugHeaders = enableDebugHeaders && isAllowedEnvironment;
  }

  // Enable/disable debug headers
  setDebugHeadersEnabled(enableDebugHeaders);

  // Configure debug headers
  configureDebugHeaders({
    prefix: config.debugHeaders?.prefix || "debug-",
    includeHeaders: config.debugHeaders?.includeHeaders || [
      "ir",
      "cache",
      "mode",
      "client-hints",
      "ua",
    ],
    specialHeaders: config.debugHeaders?.specialHeaders,
  });
}
