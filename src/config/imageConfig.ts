/**
 * Configuration for the image resizer
 */

// Image configuration object
export const imageConfig = {
  // Derivative templates
  derivatives: {
    header: {
      width: 1600,
      height: 73,
      quality: 80,
      fit: 'scale-down',
      metadata: 'copyright'
    },
    thumbnail: {
      width: 320,
      height: 150,
      quality: 85,
      fit: 'scale-down',
      metadata: 'copyright',
      sharpen: 1
    },
    avatar: {
      width: 180,
      height: 180,
      quality: 90,
      fit: 'cover',
      metadata: 'none',
      gravity: 'face'
    },
    product: {
      width: 800,
      height: 800,
      quality: 85,
      fit: 'contain',
      background: 'white'
    }
  },
  
  // Responsive configuration
  responsive: {
    availableWidths: [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840],
    breakpoints: [320, 768, 960, 1440, 1920, 2048],
    deviceWidths: {
      mobile: 480,
      tablet: 768,
      desktop: 1440
    },
    deviceMinWidthMap: {
      mobile: 320,
      tablet: 768,
      'large-desktop': 1920,
      desktop: 960
    },
    quality: 85,
    fit: 'scale-down',
    metadata: 'copyright',
    format: 'auto'
  },
  
  // Cache configuration
  caching: {
    method: 'cache-api', // Will be overridden by environment config
    debug: false,
    ttl: {
      ok: 86400,         // 1 day for successful responses
      redirects: 86400,  // 1 day for redirects
      clientError: 60,   // 1 minute for client errors
      serverError: 0     // No caching for server errors
    }
  },
  
  // Valid parameter values
  validation: {
    fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
    format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
    metadata: ['keep', 'copyright', 'none'],
    gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face']
  },
  
  // Default parameter values
  defaults: {
    quality: 85,
    fit: 'scale-down',
    format: 'auto',
    metadata: 'copyright'
  },
  
  // Parameter mapping (internal to Cloudflare)
  paramMapping: {
    width: 'width',
    height: 'height',
    fit: 'fit',
    quality: 'quality',
    format: 'format',
    dpr: 'dpr',
    metadata: 'metadata',
    gravity: 'gravity',
    sharpen: 'sharpen',
    brightness: 'brightness',
    contrast: 'contrast'
  }
};