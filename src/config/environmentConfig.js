// Configuration for remote buckets and routes
import { error } from "../utils/loggerUtils.js";
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
          config.remoteBuckets = {
            ...config.remoteBuckets,
            ...JSON.parse(value),
          };
        } catch (e) {
          error("Config", "Failed to parse REMOTE_BUCKETS env variable", {
            error: e.message,
            value: value.substring(0, 100), // Only log first 100 chars to avoid huge logs
          });
        }
      },
    },
    {
      key: "PATH_TRANSFORMS",
      handler: (value) => {
        try {
          config.pathTransforms = {
            ...config.pathTransforms,
            ...JSON.parse(value),
          };
        } catch (e) {
          error("Config", "Failed to parse PATH_TRANSFORMS env variable", {
            error: e.message,
          });
        }
      },
    },
    // Configuration for derivative templates
    {
      key: "DERIVATIVE_TEMPLATES",
      handler: (value) => {
        try {
          const parsedDerivatives = JSON.parse(value);
          // Use the new function to update imageConfig directly
          loadDerivativesFromEnv(parsedDerivatives);

          // Also keep a copy in the environment config for reference
          config.derivativeTemplates = {
            ...config.derivativeTemplates,
            ...parsedDerivatives,
          };
        } catch (e) {
          error("Config", "Failed to parse DERIVATIVE_TEMPLATES env variable", {
            error: e.message,
          });
        }
      },
    },
    // Configuration for path-based derivative mappings
    {
      key: "PATH_TEMPLATES",
      handler: (value) => {
        try {
          config.pathTemplates = {
            ...config.pathTemplates,
            ...JSON.parse(value),
          };
        } catch (e) {
          error("Config", "Failed to parse PATH_TEMPLATES env variable", {
            error: e.message,
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
            config.pathTemplates = {
              ...config.pathTemplates,
              ...JSON.parse(value),
            };
          }
        } catch (e) {
          error("Config", "Failed to parse ROUTE_DERIVATIVES env variable", {
            error: e.message,
          });
        }
      },
    },
    // Add parser for logging configuration
    {
      key: "LOGGING_CONFIG",
      handler: (value) => {
        try {
          config.logging = {
            ...config.logging,
            ...JSON.parse(value),
          };
        } catch (e) {
          error("Config", "Failed to parse LOGGING_CONFIG env variable", {
            error: e.message,
          });
        }
      },
    },
    // Add parser for debug headers configuration
    {
      key: "DEBUG_HEADERS_CONFIG",
      handler: (value) => {
        try {
          config.debugHeaders = {
            ...config.debugHeaders,
            ...JSON.parse(value),
          };
        } catch (e) {
          error("Config", "Failed to parse DEBUG_HEADERS_CONFIG env variable", {
            error: e.message,
          });
        }
      },
    },
    // Add support for direct cache configuration
    {
      key: "CACHE_CONFIG",
      handler: (value) => {
        try {
          const parsedCache = JSON.parse(value);

          // Convert string regex patterns to actual RegExp objects
          Object.values(parsedCache).forEach((cacheItem) => {
            if (cacheItem.regex && typeof cacheItem.regex === "string") {
              cacheItem.regex = new RegExp(cacheItem.regex);
            }
          });

          // Update the imageConfig directly
          updateCacheConfig(parsedCache);

          // Also keep a reference in the environment config
          config.cacheConfig = parsedCache;
        } catch (e) {
          error("Config", "Failed to parse CACHE_CONFIG env variable", {
            error: e.message,
          });
        }
      },
    },
    // Add support for responsive configuration
    {
      key: "RESPONSIVE_CONFIG",
      handler: (value) => {
        try {
          const parsedResponsive = JSON.parse(value);

          // Update the imageConfig directly
          updateResponsiveConfig(parsedResponsive);

          // Also keep a reference in the environment config
          config.responsiveConfig = parsedResponsive;
        } catch (e) {
          error("Config", "Failed to parse RESPONSIVE_CONFIG env variable", {
            error: e.message,
          });
        }
      },
    },
  ];

  // Apply each config section if environment variable exists
  configSections.forEach((section) => {
    if (env[section.key]) {
      section.handler(env[section.key]);
    }
  });

  return config;
}

// For backward compatibility, export a default config
export const environmentConfig = defaultConfig;
