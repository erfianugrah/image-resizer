/**
 * Configuration Assistant
 * Provides utilities for simplifying configuration management and display
 */
import { imageConfig, DerivativeTemplate } from './imageConfig';
import { ConfigurationManager, AppConfig } from './configManager';

/**
 * Simplified derivative template format for easier configuration
 */
export interface SimpleDerivative {
  /** Derivative name (e.g., "thumbnail", "header") */
  name: string;

  /** Width in pixels */
  width?: number;

  /** Height in pixels */
  height?: number;

  /** Quality (1-100) */
  quality?: number;

  /** Fit mode */
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

  /** Preserve metadata */
  preserveMetadata?: boolean;

  /** Apply sharpening */
  sharpen?: boolean;

  /** Use face detection */
  faceDetection?: boolean;

  /** Description for this derivative */
  description?: string;
}

/**
 * Simplified responsive configuration
 */
export interface SimpleResponsiveConfig {
  /** Default mobile width */
  mobileWidth?: number;

  /** Default tablet width */
  tabletWidth?: number;

  /** Default desktop width */
  desktopWidth?: number;

  /** Quality setting (1-100) */
  quality?: number;

  /** Auto format conversion */
  autoFormat?: boolean;

  /** Preserve EXIF data */
  preserveMetadata?: boolean;
}

/**
 * Simplified cache configuration
 */
export interface SimpleCacheConfig {
  /** Enable caching */
  enabled?: boolean;

  /** Cache TTL in seconds */
  ttl?: number;

  /** Cache errors */
  cacheErrors?: boolean;

  /** Apply image optimization */
  optimizeImages?: boolean;
}

/**
 * Configuration template presets
 */
export const configTemplates = {
  basic: {
    name: 'Basic',
    description: 'Simple configuration with essential features',
    derivatives: [
      {
        name: 'thumbnail',
        width: 320,
        height: 180,
        quality: 85,
        fit: 'scale-down',
        preserveMetadata: true,
        sharpen: true,
        description: 'Small thumbnail for listings',
      },
      {
        name: 'medium',
        width: 800,
        height: 450,
        quality: 85,
        fit: 'scale-down',
        preserveMetadata: true,
        description: 'Medium size for article images',
      },
    ],
    responsive: {
      mobileWidth: 480,
      tabletWidth: 768,
      desktopWidth: 1440,
      quality: 85,
      autoFormat: true,
      preserveMetadata: true,
    },
    cache: {
      enabled: true,
      ttl: 86400,
      cacheErrors: false,
      optimizeImages: false,
    },
  },

  ecommerce: {
    name: 'E-Commerce',
    description: 'Optimized for product images and thumbnails',
    derivatives: [
      {
        name: 'thumbnail',
        width: 200,
        height: 200,
        quality: 85,
        fit: 'cover',
        preserveMetadata: false,
        sharpen: true,
        description: 'Product thumbnail',
      },
      {
        name: 'product',
        width: 800,
        height: 800,
        quality: 85,
        fit: 'contain',
        preserveMetadata: false,
        description: 'Main product image',
      },
      {
        name: 'zoom',
        width: 1600,
        height: 1600,
        quality: 90,
        fit: 'contain',
        preserveMetadata: false,
        description: 'High-quality zoom view',
      },
      {
        name: 'banner',
        width: 1200,
        height: 400,
        quality: 85,
        fit: 'cover',
        preserveMetadata: false,
        description: 'Category banner',
      },
    ],
    responsive: {
      mobileWidth: 480,
      tabletWidth: 768,
      desktopWidth: 1440,
      quality: 85,
      autoFormat: true,
      preserveMetadata: false,
    },
    cache: {
      enabled: true,
      ttl: 604800, // 1 week
      cacheErrors: true,
      optimizeImages: true,
    },
  },

  blog: {
    name: 'Blog/Content',
    description: 'Optimized for article images and content',
    derivatives: [
      {
        name: 'thumbnail',
        width: 320,
        height: 180,
        quality: 85,
        fit: 'crop',
        preserveMetadata: true,
        sharpen: true,
        description: 'Article thumbnail',
      },
      {
        name: 'featured',
        width: 1200,
        height: 630,
        quality: 85,
        fit: 'crop',
        preserveMetadata: true,
        description: 'Featured image/social share',
      },
      {
        name: 'inline',
        width: 800,
        quality: 85,
        fit: 'scale-down',
        preserveMetadata: true,
        description: 'Inline content image',
      },
      {
        name: 'avatar',
        width: 100,
        height: 100,
        quality: 90,
        fit: 'cover',
        faceDetection: true,
        preserveMetadata: false,
        description: 'User avatar',
      },
    ],
    responsive: {
      mobileWidth: 480,
      tabletWidth: 768,
      desktopWidth: 1200,
      quality: 85,
      autoFormat: true,
      preserveMetadata: true,
    },
    cache: {
      enabled: true,
      ttl: 86400, // 1 day
      cacheErrors: false,
      optimizeImages: true,
    },
  },
};

/**
 * Convert simplified derivative to full configuration
 */
export function convertSimpleDerivative(simple: SimpleDerivative): DerivativeTemplate {
  return {
    width: simple.width || 800,
    height: simple.height || 600,
    quality: simple.quality || 85,
    fit: simple.fit || 'scale-down',
    metadata: simple.preserveMetadata ? 'copyright' : 'none',
    ...(simple.sharpen ? { sharpen: 1 } : {}),
    ...(simple.faceDetection ? { gravity: 'face' } : {}),
  };
}

/**
 * Convert simplified responsive config to full configuration
 */
export function convertSimpleResponsive(simple: SimpleResponsiveConfig): Record<string, unknown> {
  return {
    deviceWidths: {
      mobile: simple.mobileWidth || 480,
      tablet: simple.tabletWidth || 768,
      desktop: simple.desktopWidth || 1440,
    },
    quality: simple.quality || 85,
    format: simple.autoFormat ? 'auto' : 'original',
    metadata: simple.preserveMetadata ? 'copyright' : 'none',
    fit: 'scale-down',
    // Keep existing breakpoints and other properties
    availableWidths: imageConfig.responsive.availableWidths,
    breakpoints: imageConfig.responsive.breakpoints,
    deviceMinWidthMap: imageConfig.responsive.deviceMinWidthMap,
  };
}

/**
 * Convert simple cache configuration to full config
 */
export function convertSimpleCache(simple: SimpleCacheConfig): Record<string, unknown> {
  return {
    method: simple.enabled ? 'cache-api' : 'none',
    debug: false,
    imageCompression: simple.optimizeImages ? 'lossy' : 'off',
    mirage: simple.optimizeImages,
    ttl: {
      ok: simple.ttl || 86400,
      redirects: simple.ttl || 86400,
      clientError: simple.cacheErrors ? 60 : 0,
      serverError: simple.cacheErrors ? 10 : 0,
    },
  };
}

/**
 * Apply a configuration template to create a new configuration
 */
export function applyConfigTemplate(templateName: string): AppConfig | null {
  const template = configTemplates[templateName as keyof typeof configTemplates];
  if (!template) {
    return null;
  }

  // Get current config to preserve non-template settings
  const configManager = ConfigurationManager.getInstance();
  const currentConfig = configManager.getConfig();

  // Create new derivatives from template
  const derivatives: Record<string, DerivativeTemplate> = {};
  template.derivatives.forEach((derivative) => {
    // Type cast to ensure compatibility with SimpleDerivative interface
    derivatives[derivative.name] = convertSimpleDerivative(derivative as SimpleDerivative);
  });

  // Create updated config based on current config
  const updatedConfig: AppConfig = {
    ...currentConfig,
    derivatives,
    responsive: {
      ...currentConfig.responsive,
      ...convertSimpleResponsive(template.responsive),
    },
    cache: {
      ...currentConfig.cache,
      ...convertSimpleCache(template.cache),
    },
  };

  return updatedConfig;
}

/**
 * Generate a configuration summary for display
 */
export function generateConfigSummary(config: AppConfig): string {
  const derivativeCount = Object.keys(config.derivatives).length;
  const cacheEnabled = config.cache.method !== 'none';
  const debugEnabled = config.debug.enabled;

  return `
# Image Resizer Configuration

## General
- Environment: ${config.environment}
- Deployment Mode: ${config.mode}
- Version: ${config.version}

## Derivatives
- ${derivativeCount} derivatives defined
${Object.entries(config.derivatives)
  .map(
    ([name, template]) =>
      `  - ${name}: ${template.width}x${template.height}, quality ${template.quality}, fit ${template.fit}`
  )
  .join('\n')}

## Responsive Settings
- Mobile Width: ${config.responsive.deviceWidths.mobile}px
- Tablet Width: ${config.responsive.deviceWidths.tablet}px
- Desktop Width: ${config.responsive.deviceWidths.desktop}px
- Quality: ${config.responsive.quality}
- Format: ${config.responsive.format}

## Cache Settings
- Enabled: ${cacheEnabled}
- Method: ${config.cache.method}
- Success TTL: ${config.cache.ttl.ok} seconds
- Cache Client Errors: ${config.cache.ttl.clientError > 0 ? 'Yes' : 'No'}
- Cache Server Errors: ${config.cache.ttl.serverError > 0 ? 'Yes' : 'No'}

## Debug Settings
- Enabled: ${debugEnabled}
${debugEnabled ? `- Debug Headers: ${config.debug.includeHeaders?.join(', ') || 'None'}` : ''}
  `;
}

/**
 * Get template names for listing
 */
export function getTemplateNames(): string[] {
  return Object.keys(configTemplates);
}

/**
 * Get template descriptions for display
 */
export function getTemplateDescriptions(): Record<string, string> {
  const descriptions: Record<string, string> = {};

  Object.entries(configTemplates).forEach(([key, template]) => {
    descriptions[key] = template.description;
  });

  return descriptions;
}
