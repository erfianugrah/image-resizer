/**
 * Image Processing Service interfaces
 */
import { CacheConfig } from '../utils/cache';
import { DiagnosticsInfo, DebugInfo } from '../utils/debug';
import { ImageTransformOptions, IR2ImageProcessorService } from './image';
// We don't need ILogger directly in this file - but keep the import to avoid issues
import { ILogger } from '../core/logger';
import { TransformationOptionFormat } from '../../utils/transformationUtils';

/**
 * Interface for the image processing service
 */
export interface IImageProcessingService {
  /**
   * Process an image using Cloudflare's Image Resizing
   * @param request - The original request
   * @param options - Image transformation options
   * @param cache - Cache configuration
   * @param debugInfo - Debug information
   * @returns Processed image response
   */
  processImage(
    request: Request,
    options: ImageTransformOptions,
    cache: CacheConfig,
    debugInfo?: DiagnosticsInfo
  ): Promise<Response>;

  /**
   * Fetch an image with specific transformation options
   * @param request - The original request
   * @param options - Image transformation options
   * @param cache - Cache configuration
   * @param debugInfo - Debug information
   * @returns Cloudflare response
   */
  fetchWithImageOptions(
    request: Request,
    options: ImageTransformOptions,
    cache: CacheConfig,
    debugInfo: DiagnosticsInfo
  ): Promise<Response>;

  /**
   * Add debug headers and build the final response
   * @param request - Original request
   * @param response - Original Cloudflare response
   * @param options - Image transformation options
   * @param cache - Cache configuration
   * @param debugInfo - Debug information
   * @returns Final response with proper headers
   */
  buildResponse(
    request: Request,
    response: Response,
    options: ImageTransformOptions,
    cache: CacheConfig,
    debugInfo: DiagnosticsInfo
  ): Response;
}

/**
 * Dependencies for the image processing service
 */
export interface ImageProcessingDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
    info: (module: string, message: string, data?: Record<string, unknown>) => void;
    logResponse: (module: string, response: Response) => void;
  };
  debug: {
    addDebugHeaders: (
      response: Response,
      debugInfo: DebugInfo,
      diagnosticsInfo: DiagnosticsInfo
    ) => Response;
  };
  cache: {
    generateCacheTags: (source?: string, derivative?: string | null) => string[];
  };
  utils: {
    getResponsiveWidth: (
      request: Request,
      breakpoints: number[]
    ) => { width: number; source: string };
  };
  config: {
    getImageConfig: () => {
      responsive?: {
        breakpoints?: number[];
      };
    };
  };
  /**
   * Optional R2 image processor service
   */
  r2Processor?: IR2ImageProcessorService;
  /**
   * Optional transformation cache service
   */
  transformationCache?: ITransformationCacheService;
}

/**
 * Cache data for a prepared transformation
 */
export interface PreparedTransformation {
  /** Normalized transformation options */
  normalizedOptions: ImageTransformOptions;
  /** Cloudflare image object format options */
  cfObjectOptions: Record<string, string | number | boolean>;
  /** CDN-CGI path parameters */
  cdnCgiParams: string[];
  /** URL with query parameters */
  queryUrl: URL;
  /** Cache key used for the transformation */
  cacheKey: string;
}

/**
 * Interface for transformation cache service
 * Caches pre-processed transformation options to avoid redundant calculations
 */
export interface ITransformationCacheService {
  /**
   * Get cached transformation options in all required formats
   * @param options Original image transformation options
   * @returns Prepared transformation options in all formats
   */
  getPreparedTransformation(options: ImageTransformOptions): PreparedTransformation;

  /**
   * Get transformation options in a specific format
   * Uses cache to avoid redundant calculations
   * @param options Original image transformation options
   * @param format Desired output format
   * @returns Formatted transformation options
   */
  getTransformationOptions(
    options: ImageTransformOptions,
    format: TransformationOptionFormat
  ): string[] | Record<string, string | number | boolean> | URL;

  /**
   * Create response headers with proper cache control
   * Uses cached headers when possible
   * @param status Response status code
   * @param cacheConfig Cache configuration
   * @param source Source identifier for cache tags
   * @param derivative Optional derivative identifier for cache tags
   * @returns Headers object with cache control settings
   */
  createCacheHeaders(
    status: number,
    cacheConfig: CacheConfig,
    source?: string,
    derivative?: string | null
  ): Headers;

  /**
   * Clear the transformation cache
   */
  clearCache(): void;

  /**
   * Get cache statistics
   * @returns Object with cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    headerCacheSize: number;
    headerCacheHits: number;
    headerCacheMisses: number;
  };
}

/**
 * Dependencies for transformation cache service
 */
export interface TransformationCacheDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  cache?: {
    determineCacheControl: (
      status: number,
      cacheConfig: CacheConfig,
      source?: string,
      derivative?: string | null
    ) => string;
    generateCacheTags: (source?: string, derivative?: string | null) => string[];
  };
}

/**
 * Configuration for transformation cache service
 */
export interface TransformationCacheConfig {
  /** Maximum cache size */
  maxSize: number;
  /** Cache time-to-live in milliseconds */
  ttl: number;
  /** Whether the cache is enabled */
  enabled: boolean;
  /** Maximum headers cache size */
  maxHeadersCacheSize: number;
}
