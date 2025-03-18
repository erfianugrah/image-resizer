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

// Image default configuration - ALL values should be overridden by environment config in wrangler.jsonc
// This config file should only contain schema definitions and fallback values
export const imageConfig: {
  derivatives: Record<string, DerivativeTemplate>;
  responsive: ResponsiveConfig;
  caching: CachingConfig;
  validation: ValidationConfig;
  defaults: DefaultsConfig;
  paramMapping: ParamMappingConfig;
  cacheConfig?: Record<string, CacheConfigEntry>;
} = {
  // IMPORTANT: ALL of these values should be provided in DERIVATIVE_TEMPLATES in wrangler.jsonc
  // These are just fallbacks for schema definition
  derivatives: {
    // Empty by default - should be populated from DERIVATIVE_TEMPLATES in wrangler.jsonc
  },

  // IMPORTANT: ALL of these values should be provided in RESPONSIVE_CONFIG in wrangler.jsonc
  // These are just fallbacks for schema definition
  responsive: {
    // Defaults - should be overridden by RESPONSIVE_CONFIG in wrangler.jsonc
    availableWidths: [],
    breakpoints: [],
    deviceWidths: {
      mobile: 0,
      tablet: 0,
      desktop: 0,
    },
    deviceMinWidthMap: {
      mobile: 0,
      tablet: 0,
      'large-desktop': 0,
      desktop: 0,
    },
    quality: 0,
    fit: '',
    metadata: '',
    format: '',
  },

  // IMPORTANT: ALL of these values should be provided by environment config from wrangler.jsonc
  // These are just fallbacks for schema definition
  caching: {
    method: 'default', // Should be populated from CACHE_METHOD in wrangler.jsonc
    debug: false, // Should be populated from CACHE_DEBUG in wrangler.jsonc
    ttl: {
      ok: 0, // Should be populated from CACHE_CONFIG in wrangler.jsonc
      redirects: 0,
      clientError: 0,
      serverError: 0,
    },
  },

  // Valid parameter values and bounds
  // These values could be overridden by environment config, but for validation rules
  // it's generally safe to keep them in code since they're related to system constraints
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

  // Default parameter values - SHOULD be overridden by wrangler.jsonc
  defaults: {
    // These should come from the environment config but are provided as fallbacks
    quality: 85,
    fit: 'scale-down',
    format: 'auto',
    metadata: 'copyright',
  },

  // Parameter mapping (internal to Cloudflare)
  // These parameters correspond to Cloudflare's API and should be stable
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

  // Cache configuration - SHOULD be overridden by CACHE_CONFIG in wrangler.jsonc
  cacheConfig: {
    // These are fallbacks only - should be populated from CACHE_CONFIG in wrangler.jsonc
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
