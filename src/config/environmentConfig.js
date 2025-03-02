// Configuration for remote buckets and routes

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
          console.error("Failed to parse REMOTE_BUCKETS env variable", e);
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
          console.error("Failed to parse PATH_TRANSFORMS env variable", e);
        }
      },
    },
    {
      key: "ROUTE_DERIVATIVES",
      handler: (value) => {
        try {
          config.routeDerivatives = {
            ...config.routeDerivatives,
            ...JSON.parse(value),
          };
        } catch (e) {
          console.error("Failed to parse ROUTE_DERIVATIVES env variable", e);
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
