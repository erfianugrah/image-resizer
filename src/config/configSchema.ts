/**
 * Configuration Schema
 * 
 * Defines the schemas and interfaces for all configurations in the application.
 * This should be the single source of truth that both defines and validates
 * the structure of wrangler.jsonc configurations.
 */

import { z } from 'zod';

/**
 * Common Schema Fragments
 */

// Base Schema for Image Transformation Options
const imageTransformOptionsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fit: z.enum(['scale-down', 'contain', 'cover', 'crop', 'pad']).optional(),
  quality: z.number().min(1).max(100).optional(),
  format: z.enum(['auto', 'avif', 'webp', 'json', 'jpeg', 'png']).optional(),
  gravity: z.enum(['auto', 'center', 'face', 'top', 'left', 'bottom', 'right']).optional(),
  compression: z.enum(['lossless', 'lossy']).optional(),
  metadata: z.enum(['keep', 'copyright', 'none']).optional(),
  background: z.string().optional(),
  sharpen: z.number().min(0).max(10).optional(),
});

// TTL Configuration Schema
const ttlSchema = z.object({
  ok: z.number().default(86400),
  redirects: z.number().default(86400),
  clientError: z.number().default(60),
  serverError: z.number().default(10),
});

// Cache Configuration Schema
const cacheConfigSchema = z.object({
  regex: z.string().default('^.*\\.(jpe?g|JPG|png|gif|webp|svg)$'),
  ttl: ttlSchema.default({
    ok: 86400,
    redirects: 86400,
    clientError: 60,
    serverError: 10
  }),
  cacheability: z.boolean().default(true),
  mirage: z.boolean().default(false),
  imageCompression: z.union([z.string(), z.boolean(), z.null()]).default('off'),
});

// Strategies Configuration Schema
const strategyConfigSchema = z.object({
  priorityOrder: z.array(z.string()).default([
    'interceptor', 
    'direct-url', 
    'remote-fallback', 
    'direct-serving'
  ]),
  disabled: z.array(z.string()).default([]),
  enabled: z.array(z.string()).default([]),
});

// Route Configuration Schema
const routeConfigSchema = z.object({
  pattern: z.string(),
  environment: z.enum(['development', 'staging', 'production', 'test']).optional(),
  strategies: strategyConfigSchema.optional(),
  cache: z.object({
    ttl: z.number().optional(),
    enabled: z.boolean().optional(),
  }).optional(),
});

// Origin Configuration Schema
const originConfigSchema = z.object({
  default_priority: z.array(z.string()).default(['r2', 'remote', 'fallback']),
  r2: z.object({
    enabled: z.boolean().default(true),
    binding_name: z.string().default('IMAGES_BUCKET'),
  }),
  remote: z.object({
    enabled: z.boolean().default(true),
  }),
  fallback: z.object({
    enabled: z.boolean().default(true),
    url: z.string().url(),
  }),
});

// Debug Headers Configuration Schema
const debugHeadersConfigSchema = z.object({
  enabled: z.boolean().default(true),
  prefix: z.string().default('debug-'),
  includeHeaders: z.array(z.string()).default([
    'ir',
    'cache',
    'mode',
    'client-hints',
    'ua',
    'device'
  ]),
  specialHeaders: z.record(z.boolean()).default({
    'x-processing-mode': true,
    'x-size-source': true,
    'x-actual-width': true,
    'x-responsive-sizing': true
  }),
  // This property is used in loggingManager.ts but was missing from the schema
  allowedEnvironments: z.array(z.string()).optional().default([]),
  // This property is used in getDebugInfoFromRequest but was missing from the schema
  isVerbose: z.boolean().optional().default(false),
});

// Logging Configuration Schema
const loggingConfigSchema = z.object({
  level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']).default('INFO'),
  includeTimestamp: z.boolean().default(true),
  enableStructuredLogs: z.boolean().default(true),
});

// Responsive Configuration Schema
const responsiveConfigSchema = z.object({
  availableWidths: z.array(z.number()).default([
    320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840
  ]),
  breakpoints: z.array(z.number()).default([
    320, 768, 960, 1440, 1920, 2048
  ]),
  deviceWidths: z.record(z.number()).default({
    mobile: 480,
    tablet: 768,
    desktop: 1440
  }),
  deviceMinWidthMap: z.record(z.number()).default({
    mobile: 320,
    tablet: 768,
    'large-desktop': 1920,
    desktop: 960
  }),
  quality: z.number().default(85),
  fit: z.enum(['scale-down', 'contain', 'cover', 'crop', 'pad']).default('scale-down'),
  metadata: z.enum(['keep', 'copyright', 'none']).default('copyright'),
  format: z.enum(['auto', 'avif', 'webp', 'json', 'jpeg', 'png']).default('auto'),
});

// Path Transformations Schema
const pathTransformsSchema = z.record(z.object({
  prefix: z.string().default(''),
  removePrefix: z.boolean().default(false),
}));

// Path Templates Schema
const pathTemplatesSchema = z.record(z.string());

// Derivative Templates Schema
const derivativeTemplatesSchema = z.record(imageTransformOptionsSchema);

/**
 * Complete Environment Configuration Schema
 */
export const environmentConfigSchema = z.object({
  // Core configuration
  ENVIRONMENT: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DEPLOYMENT_MODE: z.enum(['remote', 'hybrid', 'local']).default('hybrid'),
  VERSION: z.string().default('1.0.0'),
  
  // Strategy configuration
  STRATEGIES_CONFIG: strategyConfigSchema.default({
    priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
    disabled: [],
    enabled: []
  }),
  
  // Logging configuration
  LOGGING_CONFIG: loggingConfigSchema.default({
    level: 'INFO',
    includeTimestamp: true,
    enableStructuredLogs: true
  }),
  
  // Cache method configuration
  CACHE_METHOD: z.enum(['cf', 'cache-api', 'none']).default('cf'),
  CACHE_DEBUG: z.union([z.string(), z.boolean()]).default(false),
  
  // Debug headers configuration
  DEBUG_HEADERS_CONFIG: debugHeadersConfigSchema.default({
    enabled: true,
    prefix: 'debug-',
    includeHeaders: ['ir', 'cache', 'mode'],
    specialHeaders: {}
  }),
  
  // Origin priorities and configuration
  ORIGIN_CONFIG: originConfigSchema,
  
  // Templates and transformations
  DERIVATIVE_TEMPLATES: derivativeTemplatesSchema.default({}),
  PATH_TEMPLATES: pathTemplatesSchema.default({}),
  PATH_TRANSFORMS: pathTransformsSchema.default({}),
  
  // Cache configuration
  CACHE_CONFIG: z.record(cacheConfigSchema).default({
    image: {
      regex: '^.*\\.(jpe?g|JPG|png|gif|webp|svg)$',
      ttl: {
        ok: 86400,
        redirects: 86400,
        clientError: 60,
        serverError: 10
      },
      cacheability: true,
      mirage: false,
      imageCompression: 'off'
    }
  }),
  
  // Responsive configuration
  RESPONSIVE_CONFIG: responsiveConfigSchema.default({
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
  }),
});

/**
 * Complete ImageResizer Config Schema
 */
export const imageResizerConfigSchema = z.object({
  routes: z.array(routeConfigSchema),
  defaults: z.object({
    strategies: strategyConfigSchema.optional(),
  }),
});

/**
 * Complete Wrangler.jsonc Schema
 */
export const wranglerConfigSchema = z.object({
  name: z.string(),
  compatibility_date: z.string(),
  main: z.string(),
  env: z.record(environmentConfigSchema),
  imageResizer: imageResizerConfigSchema.optional(),
});

// Export types generated from the schemas
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;
export type ImageResizerConfig = z.infer<typeof imageResizerConfigSchema>;
export type WranglerConfig = z.infer<typeof wranglerConfigSchema>;
export type StrategyConfig = z.infer<typeof strategyConfigSchema>;
export type RouteConfig = z.infer<typeof routeConfigSchema>;
export type OriginConfig = z.infer<typeof originConfigSchema>;
export type CacheConfig = z.infer<typeof cacheConfigSchema>;
export type TTLConfig = z.infer<typeof ttlSchema>;
export type ResponsiveConfig = z.infer<typeof responsiveConfigSchema>;
export type DerivativeTemplates = z.infer<typeof derivativeTemplatesSchema>;
export type PathTransforms = z.infer<typeof pathTransformsSchema>;
export type PathTemplates = z.infer<typeof pathTemplatesSchema>;
export type DebugHeadersConfig = z.infer<typeof debugHeadersConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type ImageTransformOptions = z.infer<typeof imageTransformOptionsSchema>;