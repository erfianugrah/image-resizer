/**
 * Configuration for the image resizer
 */
import { z } from 'zod';

// Define TypeScript interfaces for our config
export interface DerivativeTemplate {
  width: number;
  height: number;
  quality: number;
  fit: string;
  metadata: string;
  sharpen?: number;
  gravity?: string;
  background?: string;
  [key: string]: string | number | boolean | undefined;
}

// Create a type that includes Record<string, unknown> to fix index signature issues
export type DerivativeTemplateRecord = DerivativeTemplate & Record<string, unknown>;

export interface ResponsiveConfig {
  availableWidths: number[];
  breakpoints: number[];
  deviceWidths: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  deviceMinWidthMap: {
    mobile: number;
    tablet: number;
    'large-desktop': number;
    desktop: number;
  };
  quality: number;
  fit: string;
  metadata: string;
  format: string;
}

export interface CachingConfig {
  method: string;
  debug: boolean;
  imageCompression?: string;
  mirage?: boolean;
  ttl: {
    ok: number;
    redirects: number;
    clientError: number;
    serverError: number;
  };
}

export interface ValidationConfig {
  fit: string[];
  format: string[];
  metadata: string[];
  gravity: string[];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minQuality?: number;
  maxQuality?: number;
}

export interface DefaultsConfig {
  quality: number;
  fit: string;
  format: string;
  metadata: string;
}

export interface ParamMappingConfig {
  width: string;
  height: string;
  fit: string;
  quality: string;
  format: string;
  dpr: string;
  metadata: string;
  gravity: string;
  sharpen: string;
  brightness: string;
  contrast: string;
}

// Add a cache configuration interface
export interface CacheConfigEntry {
  regex: string;
  ttl: {
    ok: number;
    redirects: number;
    clientError: number;
    serverError: number;
  };
  cacheability: boolean;
  mirage?: boolean;
  imageCompression?: string;
}

// Image configuration object
export const imageConfig: {
  derivatives: Record<string, DerivativeTemplate>;
  responsive: ResponsiveConfig;
  caching: CachingConfig;
  validation: ValidationConfig;
  defaults: DefaultsConfig;
  paramMapping: ParamMappingConfig;
  cacheConfig?: Record<string, CacheConfigEntry>;
} = {
  // Derivative templates
  derivatives: {
    header: {
      width: 1600,
      height: 73,
      quality: 80,
      fit: 'scale-down',
      metadata: 'copyright',
    },
    thumbnail: {
      width: 320,
      height: 150,
      quality: 85,
      fit: 'scale-down',
      metadata: 'copyright',
      sharpen: 1,
    },
    avatar: {
      width: 180,
      height: 180,
      quality: 90,
      fit: 'cover',
      metadata: 'none',
      gravity: 'face',
    },
    product: {
      width: 800,
      height: 800,
      quality: 85,
      fit: 'contain',
      metadata: 'none',
      background: 'white',
    },
  },

  // Responsive configuration
  responsive: {
    availableWidths: [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840],
    breakpoints: [320, 768, 960, 1440, 1920, 2048],
    deviceWidths: {
      mobile: 480,
      tablet: 768,
      desktop: 1440,
    },
    deviceMinWidthMap: {
      mobile: 320,
      tablet: 768,
      'large-desktop': 1920,
      desktop: 960,
    },
    quality: 85,
    fit: 'scale-down',
    metadata: 'copyright',
    format: 'auto',
  },

  // Cache configuration
  caching: {
    method: 'cache-api', // Will be overridden by environment config
    debug: false,
    ttl: {
      ok: 86400, // 1 day for successful responses
      redirects: 86400, // 1 day for redirects
      clientError: 60, // 1 minute for client errors
      serverError: 0, // No caching for server errors
    },
  },

  // Valid parameter values with bounds
  validation: {
    fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
    format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
    metadata: ['keep', 'copyright', 'none'],
    gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'],
    minWidth: 10,
    maxWidth: 8192,
    minHeight: 10,
    maxHeight: 8192,
    minQuality: 1,
    maxQuality: 100,
  },

  // Default parameter values
  defaults: {
    quality: 85,
    fit: 'scale-down',
    format: 'auto',
    metadata: 'copyright',
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
    contrast: 'contrast',
  },

  // Cache configuration for different file types
  cacheConfig: {
    image: {
      regex: '^.*\\.(jpe?g|JPG|png|gif|webp|svg)$',
      ttl: {
        ok: 31536000,
        redirects: 31536000,
        clientError: 10,
        serverError: 1,
      },
      cacheability: true,
      mirage: false,
      imageCompression: 'off',
    },
    staticAssets: {
      regex: '^.*\\.(css|js)$',
      ttl: {
        ok: 86400,
        redirects: 86400,
        clientError: 10,
        serverError: 1,
      },
      cacheability: true,
      mirage: false,
      imageCompression: 'off',
    },
  },
};

// Create a Zod schema for validating the image configuration
export const imageConfigSchema = z.object({
  derivatives: z.record(
    z
      .object({
        width: z.number().int().min(10).max(8192).optional(),
        height: z.number().int().min(10).max(8192).optional(),
        quality: z.number().int().min(1).max(100).optional(),
        fit: z.enum(['scale-down', 'contain', 'cover', 'crop', 'pad']).optional(),
        metadata: z.enum(['keep', 'copyright', 'none']).optional(),
        sharpen: z.number().min(0).max(10).optional(),
        gravity: z.enum(['auto', 'center', 'top', 'bottom', 'left', 'right', 'face']).optional(),
        background: z
          .string()
          .regex(/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
          .optional(),
      })
      .passthrough()
  ),
  responsive: z.object({
    availableWidths: z.array(z.number()),
    breakpoints: z.array(z.number()),
    deviceWidths: z.record(z.number()),
    deviceMinWidthMap: z.record(z.number()),
    quality: z.number().int().min(1).max(100),
    fit: z.string(),
    metadata: z.string(),
    format: z.string(),
  }),
  validation: z.object({
    fit: z.array(z.string()),
    format: z.array(z.string()),
    metadata: z.array(z.string()),
    gravity: z.array(z.string()),
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
    minQuality: z.number().optional(),
    maxQuality: z.number().optional(),
  }),
  defaults: z.object({
    quality: z.number().int().min(1).max(100),
    fit: z.string(),
    format: z.string(),
    metadata: z.string(),
  }),
  paramMapping: z.record(z.string()).optional(),
  caching: z
    .object({
      method: z.string(),
      debug: z.boolean(),
      ttl: z.object({
        ok: z.number(),
        redirects: z.number(),
        clientError: z.number(),
        serverError: z.number(),
      }),
    })
    .optional(),
  cacheConfig: z.record(z.any()).optional(),
});
