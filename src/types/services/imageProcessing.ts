/**
 * Image Processing Service interfaces
 */
import { CacheConfig } from '../utils/cache';
import { DiagnosticsInfo, DebugInfo } from '../utils/debug';
import { ImageTransformOptions } from './image';
// We don't need ILogger directly in this file
import { _ILogger } from '../core/logger';

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
}
