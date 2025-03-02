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
    // New configuration for derivative templates
    {
      key: "DERIVATIVE_TEMPLATES",
      handler: (value) => {
        try {
          config.derivativeTemplates = {
            ...config.derivativeTemplates,
            ...JSON.parse(value),
          };
        } catch (e) {
          console.error("Failed to parse DERIVATIVE_TEMPLATES env variable", e);
        }
      },
    },
    // New configuration for path-based derivative mappings
    {
      key: "PATH_TEMPLATES",
      handler: (value) => {
        try {
          config.pathTemplates = {
            ...config.pathTemplates,
            ...JSON.parse(value),
          };
        } catch (e) {
          console.error("Failed to parse PATH_TEMPLATES env variable", e);
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
