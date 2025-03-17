/**
 * Image transformation service interfaces
 */

import { DebugInfo, DiagnosticsInfo } from '../utils/debug';
import { CacheConfig } from '../utils/cache';

/**
 * Image transformation options interface
 */
export interface ImageTransformOptions {
  width?: number | string | null;
  height?: number | null;
  fit?: string | null;
  quality?: number | null;
  format?: string | null;
  dpr?: number | null;
  metadata?: string | null;
  gravity?: string | null;
  sharpen?: number | null;
  brightness?: number | null;
  contrast?: number | null;
  source?: string;
  derivative?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Transform command context interface
 */
export interface ImageTransformContext {
  request: Request;
  options: ImageTransformOptions;
  pathPatterns?: { name: string; matcher: string; [key: string]: unknown }[];
  debugInfo?: DebugInfo;
  config: unknown; // Environment configuration
}

/**
 * Interface for the image transformation service
 */
export interface IImageTransformationService {
  transformImage(
    request: Request,
    options: ImageTransformOptions,
    pathPatterns?: { name: string; matcher: string; [key: string]: unknown }[],
    debugInfo?: DebugInfo,
    config?: unknown
  ): Promise<Response>;

  getBestImageFormat(request: Request): string;
}

/**
 * Dependencies for the image transformation service
 */
export interface ImageTransformationDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
    logResponse: (module: string, response: Response) => void;
  };
  cache: {
    getCachedResponse: (request: Request) => Promise<Response | null>;
    cacheResponse: (request: Request, response: Response) => Promise<boolean>;
    applyCacheHeaders: (
      response: Response,
      status: number,
      cacheConfig?: CacheConfig | null,
      source?: string,
      derivative?: string
    ) => Response;
  };
  /**
   * Optional format utilities for determining best image formats
   */
  formatUtils?: {
    getBestSupportedFormat: (request: Request, format?: string) => string;
    getFormatFromAcceptHeader: (acceptHeader: string) => string | null;
  };
  /**
   * Optional URL transform utilities for processing URLs
   */
  urlTransformUtils?: {
    transformUrlToImageDelivery: (url: string) => string;
    processUrl: (
      url: string,
      options?: Record<string, unknown>
    ) => {
      sourceUrl: string;
      transformedUrl: string;
      options: Record<string, unknown>;
    };
  };
}

/**
 * Image options service interface
 */
export interface IImageOptionsService {
  /**
   * Determine image options for a request
   * @param request - The original request
   * @param urlParams - URL search parameters
   * @param pathname - URL path
   * @returns Image transformation options
   */
  determineImageOptions(
    request: Request,
    urlParams: URLSearchParams,
    pathname: string
  ): Promise<ImageTransformOptions>;

  /**
   * Handle width=auto by determining appropriate responsive width
   * @param request - Original request
   * @param options - Current image options with width=auto
   * @returns Updated options with width as a number
   */
  handleAutoWidth(request: Request, options: ImageTransformOptions): ImageTransformOptions;
}

/**
 * Dependencies for the image options service
 */
export interface ImageOptionsServiceDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  config: {
    getConfig: () => {
      derivatives: Record<string, unknown>;
      responsive: {
        breakpoints?: number[];
        deviceWidths?: Record<string, number>;
      };
      defaults: Record<string, unknown>;
    };
  };
  clientDetection: {
    hasClientHints: (request: Request) => boolean;
    getViewportWidth: (request: Request) => number | null;
    getDevicePixelRatio: (request: Request) => number | null;
    hasCfDeviceType: (request: Request) => boolean;
    getDeviceInfo: (deviceType: string) => { width: number };
    getDeviceTypeFromUserAgent: (userAgent: string) => string;
  };
  urlUtils: {
    extractImageParams: (urlParams: URLSearchParams, pathname: string) => void;
    snapToBreakpoint: (width: number, breakpoints: number[]) => number;
  };
  optionsFactory: {
    create: (config: {
      derivatives: Record<string, unknown>;
      responsive: Record<string, unknown>;
      defaults: Record<string, unknown>;
    }) => {
      createImageOptions: (
        request: Request,
        urlParams: URLSearchParams
      ) => Promise<ImageTransformOptions>;
    };
  };
}

/**
 * Interface for image processing service
 */
export interface IImageProcessingService {
  processImage(
    request: Request,
    options: ImageTransformOptions,
    cache: CacheConfig,
    debugInfo?: DiagnosticsInfo
  ): Promise<Response>;
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
    generateCacheTags: (bucketName?: string, derivative?: string | null) => string[];
  };
  utils: {
    getResponsiveWidth: (
      request: Request,
      breakpoints: number[]
    ) => { width: number; source: string };
    /**
     * Optional validation utility for image options
     */
    validateImageOptions?: (options: Record<string, unknown>) => {
      isValid: boolean;
      errors: string[];
      value: Record<string, unknown>;
    };
    /**
     * Optional utility to check if a path is an image
     */
    isImagePath?: (path: string) => boolean;
  };
  config: {
    getImageConfig: () => Record<string, unknown>;
  };
}
