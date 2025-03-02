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
      height: Math.floor(1600 / 22), // Based on 1:22 aspect ratio
      quality: 80,
      fit: "scale-down",
      format: "auto", // Let browser negotiation determine format
      metadata: "copyright",
      // Additional CF-supported parameters that can be overridden
      dpr: 1,
      gravity: "auto",
      trim: null,
      // Visual adjustments
      brightness: 0,
      contrast: 0,
      gamma: 0,
      rotate: null,
      sharpen: 0,
      saturation: 0,
      // Optional settings
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
      height: Math.floor(150 / 27), // Based on 1:27 aspect ratio
      quality: 85,
      fit: "scale-down",
      format: "auto",
      metadata: "copyright",
      gravity: "auto",
      trim: null,
      // Visual adjustments (optimized for thumbnails)
      brightness: 0,
      contrast: 5, // Slightly increased contrast for thumbnails
      gamma: 0,
      rotate: null,
      sharpen: 1, // Light sharpening for thumbnails
      saturation: 5, // Slightly increased saturation for thumbnails
      // Optional settings
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
      dpr: 1,
    },
    // Default policy (multiple sizes, 1:30 ratio, 85% quality)
    default: {
      widths: [320, 640, 1024, 2048, 5000],
      responsiveWidths: [320, 768, 960, 1200], // For width=auto
      aspectRatio: 1 / 30, // 1:30 aspect ratio
      quality: 85,
      fit: "scale-down",
      format: "auto",
      metadata: "copyright",
      // Visual adjustment defaults
      brightness: 0,
      contrast: 0,
      gamma: 0,
      rotate: null,
      sharpen: 0,
      saturation: 0,
      // Optional settings
      gravity: "auto",
      trim: null,
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: true,
      dpr: 1,
    },
  },
};
