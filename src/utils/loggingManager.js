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
      enabled: false, // Default to false so it must be explicitly enabled
      prefix: "debug-",
      includeHeaders: ["ir", "cache", "mode", "client-hints", "ua"],
    },
  };

  // Try to parse LOGGING_CONFIG if present
  let loggingConfig = { ...defaultConfig };

  if (env.LOGGING_CONFIG) {
    try {
      // Handle both string and object values
      let parsed = env.LOGGING_CONFIG;
      
      // If it's a string, try to parse it as JSON
      if (typeof env.LOGGING_CONFIG === 'string') {
        parsed = JSON.parse(env.LOGGING_CONFIG);
      }
      
      if (parsed && typeof parsed === 'object') {
        loggingConfig = { ...loggingConfig, ...parsed };
      }
    } catch (err) {
      warn("Config", "Failed to parse LOGGING_CONFIG", { 
        error: err.message,
        type: typeof env.LOGGING_CONFIG 
      });
    }
  }

  // Try to parse DEBUG_HEADERS_CONFIG if present
  if (env.DEBUG_HEADERS_CONFIG) {
    try {
      // Handle both string and object values
      let parsed = env.DEBUG_HEADERS_CONFIG;
      
      // If it's a string, try to parse it as JSON
      if (typeof env.DEBUG_HEADERS_CONFIG === 'string') {
        parsed = JSON.parse(env.DEBUG_HEADERS_CONFIG);
      }
      
      if (parsed && typeof parsed === 'object') {
        // Log what we've parsed to help troubleshoot
        debug("Config", "Parsed DEBUG_HEADERS_CONFIG", { 
          type: typeof env.DEBUG_HEADERS_CONFIG,
          parsed: JSON.stringify(parsed)
        });
        
        loggingConfig.debugHeaders = {
          ...loggingConfig.debugHeaders,
          ...parsed,
        };
        
        // Explicitly log the enabled state after parsing
        debug("Config", "Debug headers enabled state after parsing", {
          enabled: loggingConfig.debugHeaders.enabled
        });
      }
    } catch (err) {
      warn("Config", "Failed to parse DEBUG_HEADERS_CONFIG", {
        error: err.message,
        type: typeof env.DEBUG_HEADERS_CONFIG
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
  // Determine if debug headers should be enabled - check enabled is strictly true
  // Default to false unless explicitly enabled
  let enableDebugHeaders = config.debugHeaders && config.debugHeaders.enabled === true;
  
  // Log the debug headers config we received
  debug("Logging", "Debug headers configuration received", { 
    configValue: config.debugHeaders?.enabled,
    enabledValue: enableDebugHeaders,
    rawConfig: JSON.stringify(config.debugHeaders || {})
  });

  // Apply environment filtering if configured
  if (config.debugHeaders?.allowedEnvironments && env.ENVIRONMENT) {
    const isAllowedEnvironment = config.debugHeaders.allowedEnvironments
      .includes(env.ENVIRONMENT);
    enableDebugHeaders = enableDebugHeaders && isAllowedEnvironment;
  }

  // Enable/disable debug headers - this is critical to set before configuring
  setDebugHeadersEnabled(enableDebugHeaders);

  // Configure debug headers - IMPORTANT: pass the enabled state explicitly 
  // to prevent the default from overriding our setting
  configureDebugHeaders({
    enabled: enableDebugHeaders, // Pass the enabled state explicitly
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
  
  // Log the final state to verify
  debug("Logging", "Debug headers final configuration", {
    enabled: enableDebugHeaders
  });
}
