// Configuration for remote buckets and routes
// This module should be imported with 'env' parameter when available
// e.g., import { getEnvironmentConfig } from "../config/environmentConfig";
// const environmentConfig = getEnvironmentConfig(env);

// Default configuration
const defaultConfig = {
  // Worker deployment mode
  deploymentMode: "direct", // Default to direct mode

  // Remote bucket configuration - used when deploymentMode is "remote"
  remoteBuckets: {
    // Default empty config that will be populated from env
    "default": "https://default-origin.example.com",
  },

  // Remote bucket path transformations
  pathTransforms: {
    "images": {
      prefix: "",
      removePrefix: true,
    },
  },

  // Route configuration - automatically apply derivatives based on route
  routeDerivatives: {
    "profile-pictures": "thumbnail",
    "hero-banners": "header",
  },
};

/**
 * Get environment configuration with runtime env variables
 * @param {Object} env - Environment variables from Cloudflare
 * @returns {Object} - Configuration object
 */
export function getEnvironmentConfig(env = {}) {
  const config = { ...defaultConfig };

  // Update deployment mode from env
  if (env.DEPLOYMENT_MODE) {
    config.deploymentMode = env.DEPLOYMENT_MODE;
  }

  // Update remote buckets from env
  if (env.REMOTE_BUCKETS) {
    try {
      const remoteBuckets = JSON.parse(env.REMOTE_BUCKETS);
      config.remoteBuckets = {
        ...config.remoteBuckets,
        ...remoteBuckets,
      };
    } catch (e) {
      console.error("Failed to parse REMOTE_BUCKETS env variable", e);
    }
  }

  // Update path transforms from env
  if (env.PATH_TRANSFORMS) {
    try {
      const pathTransforms = JSON.parse(env.PATH_TRANSFORMS);
      config.pathTransforms = {
        ...config.pathTransforms,
        ...pathTransforms,
      };
    } catch (e) {
      console.error("Failed to parse PATH_TRANSFORMS env variable", e);
    }
  }

  // Update route derivatives from env
  if (env.ROUTE_DERIVATIVES) {
    try {
      const routeDerivatives = JSON.parse(env.ROUTE_DERIVATIVES);
      config.routeDerivatives = {
        ...config.routeDerivatives,
        ...routeDerivatives,
      };
    } catch (e) {
      console.error("Failed to parse ROUTE_DERIVATIVES env variable", e);
    }
  }

  return config;
}

// For backward compatibility, export a default config
export const environmentConfig = defaultConfig;
