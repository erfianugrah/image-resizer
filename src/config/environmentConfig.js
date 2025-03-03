// Configuration for remote buckets and routes
import { error, info } from "../utils/loggerUtils.js";
import {
  loadDerivativesFromEnv,
  updateCacheConfig,
  updateResponsiveConfig,
} from "./imageConfig.js";

// Default configuration
const defaultConfig = {
  // Worker deployment mode
  deploymentMode: "direct", // Default to direct mode

  // Remote bucket configuration - used when deploymentMode is "remote"
  remoteBuckets: {
    // Default empty config that will be populated from env
    "default": "",
  },

  // Remote bucket path transformations
  pathTransforms: {
    "images": {
      prefix: "",
      removePrefix: true,
    },
  },

  // Derivative templates - predefined image transformation settings
  derivativeTemplates: {
    "header": {
      width: 1600,
      height: 73,
      quality: 80,
      fit: "scale-down",
      metadata: "copyright",
    },
    "thumbnail": {
      width: 320,
      height: 150,
      quality: 85,
      fit: "scale-down",
      metadata: "copyright",
      sharpen: 1,
    },
  },

  // Path-based mappings to derivatives
  pathTemplates: {
    "profile-pictures": "thumbnail",
    "hero-banners": "header",
    "header": "header",
    "thumbnail": "thumbnail",
  },

  // Default logging configuration
  logging: {
    level: "INFO",
    includeTimestamp: true,
    enableStructuredLogs: true,
  },

  // Default debug headers configuration
  debugHeaders: {
    enabled: true,
    prefix: "debug-",
    includeHeaders: ["ir", "cache", "mode", "client-hints", "ua"],
  },
};

/**
 * Get environment configuration with runtime env variables
 * @param {Object} env - Environment variables from Cloudflare
 * @returns {Object} - Configuration object
 */
export function getEnvironmentConfig(env = {}) {
  // Start with default config
  const config = { ...defaultConfig };

  // Define config sections to update from environment
  const configSections = [
    {
      key: "DEPLOYMENT_MODE",
      handler: (value) => config.deploymentMode = value,
    },
    {
      key: "REMOTE_BUCKETS",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsed = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsed = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsed && typeof parsed === 'object') {
            config.remoteBuckets = {
              ...config.remoteBuckets,
              ...parsed,
            };
          } else {
            error("Config", "REMOTE_BUCKETS env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100), // Only log first 100 chars to avoid huge logs
            });
          }
        } catch (e) {
          error("Config", "Failed to parse REMOTE_BUCKETS env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100), // Only log first 100 chars to avoid huge logs
          });
        }
      },
    },
    {
      key: "PATH_TRANSFORMS",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsed = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsed = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsed && typeof parsed === 'object') {
            config.pathTransforms = {
              ...config.pathTransforms,
              ...parsed,
            };
          } else {
            error("Config", "PATH_TRANSFORMS env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse PATH_TRANSFORMS env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Configuration for derivative templates
    {
      key: "DERIVATIVE_TEMPLATES",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsedDerivatives = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsedDerivatives = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsedDerivatives && typeof parsedDerivatives === 'object') {
            // Use the new function to update imageConfig directly
            loadDerivativesFromEnv(parsedDerivatives);

            // Also keep a copy in the environment config for reference
            config.derivativeTemplates = {
              ...config.derivativeTemplates,
              ...parsedDerivatives,
            };
          } else {
            error("Config", "DERIVATIVE_TEMPLATES env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse DERIVATIVE_TEMPLATES env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Configuration for path-based derivative mappings
    {
      key: "PATH_TEMPLATES",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsed = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsed = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsed && typeof parsed === 'object') {
            config.pathTemplates = {
              ...config.pathTemplates,
              ...parsed,
            };
          } else {
            error("Config", "PATH_TEMPLATES env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse PATH_TEMPLATES env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Handle legacy ROUTE_DERIVATIVES for backward compatibility
    {
      key: "ROUTE_DERIVATIVES",
      handler: (value) => {
        try {
          // Only use if PATH_TEMPLATES not present
          if (!env.PATH_TEMPLATES) {
            // Handle both string and object inputs
            let parsed = value;
            
            // If it's a string, try to parse it as JSON
            if (typeof value === 'string') {
              parsed = JSON.parse(value);
            }
            
            // Make sure we have an object
            if (parsed && typeof parsed === 'object') {
              config.pathTemplates = {
                ...config.pathTemplates,
                ...parsed,
              };
            } else {
              error("Config", "ROUTE_DERIVATIVES env variable is not a valid object", {
                value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
              });
            }
          } else {
            // Log a warning if both are present
            info("Config", "ROUTE_DERIVATIVES is ignored because PATH_TEMPLATES is present");
          }
        } catch (e) {
          error("Config", "Failed to parse ROUTE_DERIVATIVES env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Add parser for logging configuration
    {
      key: "LOGGING_CONFIG",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsed = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsed = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsed && typeof parsed === 'object') {
            config.logging = {
              ...config.logging,
              ...parsed,
            };
          } else {
            error("Config", "LOGGING_CONFIG env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse LOGGING_CONFIG env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Add parser for debug headers configuration
    {
      key: "DEBUG_HEADERS_CONFIG",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsed = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsed = JSON.parse(value);
          }
          
          // Make sure we have an object
          if (parsed && typeof parsed === 'object') {
            config.debugHeaders = {
              ...config.debugHeaders,
              ...parsed,
            };
          } else {
            error("Config", "DEBUG_HEADERS_CONFIG env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse DEBUG_HEADERS_CONFIG env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Add support for direct cache configuration
    {
      key: "CACHE_CONFIG",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsedCache = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsedCache = JSON.parse(value);
          }
          
          if (parsedCache && typeof parsedCache === 'object') {
            // Convert string regex patterns to actual RegExp objects
            Object.values(parsedCache).forEach((cacheItem) => {
              if (cacheItem && cacheItem.regex) {
                if (typeof cacheItem.regex === "string") {
                  try {
                    cacheItem.regex = new RegExp(cacheItem.regex);
                  } catch (regexErr) {
                    error("Config", "Invalid regex pattern in CACHE_CONFIG", {
                      error: regexErr.message,
                      pattern: cacheItem.regex
                    });
                    // Keep it as a string if the conversion fails
                  }
                } else if (typeof cacheItem.regex === "object" && !(cacheItem.regex instanceof RegExp)) {
                  // If it's an object but not a RegExp, convert to string then to RegExp
                  try {
                    const regexStr = cacheItem.regex.toString();
                    // Remove object notation
                    const cleanRegexStr = regexStr.replace(/^\{|\}$/g, '');
                    cacheItem.regex = new RegExp(cleanRegexStr);
                  } catch (err) {
                    error("Config", "Failed to convert cache regex to RegExp", {
                      error: err.message,
                      regex: JSON.stringify(cacheItem.regex)
                    });
                    // Create a fallback regex that matches everything
                    cacheItem.regex = new RegExp(".*");
                  }
                }
              }
            });

            // Update the imageConfig directly
            updateCacheConfig(parsedCache);

            // Also keep a reference in the environment config
            config.cacheConfig = parsedCache;
          } else {
            error("Config", "CACHE_CONFIG env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse CACHE_CONFIG env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
    // Add support for responsive configuration
    {
      key: "RESPONSIVE_CONFIG",
      handler: (value) => {
        try {
          // Handle both string and object inputs
          let parsedResponsive = value;
          
          // If it's a string, try to parse it as JSON
          if (typeof value === 'string') {
            parsedResponsive = JSON.parse(value);
          }
          
          if (parsedResponsive && typeof parsedResponsive === 'object') {
            // Update the imageConfig directly
            updateResponsiveConfig(parsedResponsive);

            // Also keep a reference in the environment config
            config.responsiveConfig = parsedResponsive;
          } else {
            error("Config", "RESPONSIVE_CONFIG env variable is not a valid object", {
              value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
            });
          }
        } catch (e) {
          error("Config", "Failed to parse RESPONSIVE_CONFIG env variable", {
            error: e.message,
            value: typeof value === 'string' ? value.substring(0, 100) : String(value).substring(0, 100),
          });
        }
      },
    },
  ];

  // Apply each config section if environment variable exists
  configSections.forEach((section) => {
    if (env[section.key]) {
      try {
        // Log which configuration section is being processed
        info("Config", `Loading config section: ${section.key}`);
        
        // Apply the handler
        section.handler(env[section.key]);
      } catch (e) {
        error("Config", `Unexpected error processing ${section.key}`, {
          error: e.message,
          stack: e.stack
        });
      }
    }
  });

  // Log a summary of the loaded configuration
  info("Config", "Configuration loaded successfully", {
    deploymentMode: config.deploymentMode,
    configSections: Object.keys(config)
  });

  return config;
}

// For backward compatibility, export a default config
export const environmentConfig = defaultConfig;
