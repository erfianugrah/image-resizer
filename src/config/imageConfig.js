// Configuration for image resizing
export const imageConfig = {
  cache: {
    image: {
      regex: /^.*\.(jpe?g|JPG|png|gif|webp|svg)$/,
      ttl: {
        ok: 31536000, // 1 year for successful responses
        redirects: 31536000, // 1 year for redirects
        clientError: 10, // 10 seconds for client errors
        serverError: 1, // 1 second for server errors
      },
      cacheability: true,
      mirage: false,
      imageCompression: "off",
    },
  },
  derivatives: {
    // Header resize configuration (1600px, 1:22 ratio, 80% quality)
    header: {
      width: 1600,
      height: 73,
      quality: 80,
      fit: "scale-down",
      format: "auto",
      metadata: "copyright",
      dpr: 1,
      gravity: "auto",
      trim: null,
      brightness: 0,
      contrast: 0,
      gamma: 0,
      rotate: null,
      sharpen: 0,
      saturation: 0,
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
    },
    // Thumbnail configuration (320px, 1:27 ratio, 85% quality)
    thumbnail: {
      width: 320,
      height: 150,
      quality: 85,
      fit: "scale-down",
      format: "auto",
      metadata: "copyright",
      gravity: "auto",
      trim: null,
      brightness: 0,
      contrast: 5,
      gamma: 0,
      rotate: null,
      sharpen: 1,
      saturation: 5,
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
      dpr: 1,
    },
    // Avatar configuration (180x180, 90% quality, face detection)
    avatar: {
      width: 180,
      height: 180,
      quality: 90,
      fit: "cover",
      format: "auto",
      metadata: "none",
      gravity: "face",
      trim: null,
      brightness: 0,
      contrast: 0,
      gamma: 0,
      rotate: null,
      sharpen: 2,
      saturation: 0,
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
      dpr: 1,
    },
    // Product configuration (800x800, 85% quality, white background)
    product: {
      width: 800,
      height: 800,
      quality: 85,
      fit: "contain",
      format: "auto",
      metadata: "copyright",
      gravity: "auto",
      trim: null,
      brightness: 0,
      contrast: 0,
      gamma: 0,
      rotate: null,
      sharpen: 0,
      saturation: 0,
      background: "white",
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
      dpr: 1,
    },
  },
  // Responsive mode settings (not a derivative)
  responsive: {
    // Available widths for explicit width selection
    availableWidths: [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840],
    // Widths used for auto-responsive sizing
    breakpoints: [320, 768, 960, 1440, 1920, 2048],
    // Cloudflare device type to width mapping
    deviceWidths: {
      "mobile": 480, // Mobile specific width (480p)
      "tablet": 768, // Tablet specific width (768p)
      "desktop": 1440, // Desktop specific width (1440p)
    },
    // Device type to minimum width mapping for user-agent detection
    deviceMinWidthMap: {
      "mobile": 320,
      "tablet": 768,
      "large-desktop": 1920,
      "desktop": 960, // Default for desktop (will be 1440 if auto requested)
    },
    // Default quality setting
    quality: 85,
    // Default fit setting
    fit: "scale-down",
    // Default metadata setting
    metadata: "copyright",
    // Default format
    format: "auto",
  },
};

/**
 * Update imageConfig with environment settings
 * @param {Object} envDerivatives - Derivatives from environment
 */
export function loadDerivativesFromEnv(envDerivatives) {
  if (!envDerivatives) return;

  // Properly merge environment derivatives with defaults
  imageConfig.derivatives = {
    ...imageConfig.derivatives,
    ...envDerivatives,
  };
}

/**
 * Update cache configuration with environment settings
 * @param {Object} envCache - Cache configuration from environment
 */
export function updateCacheConfig(envCache) {
  if (!envCache) return;

  // Properly merge environment cache settings with defaults
  imageConfig.cache = {
    ...imageConfig.cache,
    ...envCache,
  };
}

/**
 * Update responsive configuration with environment settings
 * @param {Object} envResponsive - Responsive configuration from environment
 */
export function updateResponsiveConfig(envResponsive) {
  if (!envResponsive) return;

  // Properly merge environment responsive settings with defaults
  imageConfig.responsive = {
    ...imageConfig.responsive,
    ...envResponsive,
  };
}
