/**
 * Command for transforming images using Cloudflare Image Resizing
 */
import { debug, error } from '../../utils/loggerUtils';
import { determineCacheConfig } from '../../utils/cacheUtils';
import { DebugInfo } from '../../utils/debugHeadersUtils';
import { PathPattern } from '../../utils/pathUtils';

// Define diagnostics interface to avoid using any
export interface DiagnosticsData {
  errors: string[];
  warnings: string[];
  originalUrl: string;
  processingTimeMs?: number;
  transformParams?: Record<string, string | number | boolean | null | undefined>;
  pathMatch?: string;
  clientHints?: boolean;
  deviceType?: string;
}

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

// Create a type that includes Record<string, unknown> to fix index signature issues
export type ImageTransformOptionsRecord = ImageTransformOptions & Record<string, unknown>;

export interface ImageTransformContext {
  request: Request;
  options: ImageTransformOptions;
  pathPatterns?: PathPattern[];
  debugInfo?: DebugInfo;
  config: unknown; // Environment configuration
}

export type TransformParamValue = string | number | boolean | null;
export type TransformParams = Record<string, TransformParamValue>;

/**
 * Command class for transforming image URLs
 */
export class TransformImageCommand {
  private context: ImageTransformContext;

  constructor(context: ImageTransformContext) {
    this.context = context;
  }

  /**
   * Execute the image transformation
   * @returns A response with the transformed image
   */
  async execute(): Promise<Response> {
    // Start timing for performance measurement
    const startTime = performance.now();

    // Initialize diagnostics information
    const diagnosticsInfo: DiagnosticsData = {
      errors: [],
      warnings: [],
      originalUrl: this.context.request.url,
    };

    try {
      // Extract context information
      const { request, options } = this.context;
      const url = new URL(request.url);

      // Validate options
      this.validateOptions(options);

      // Get cache configuration for the image URL
      const cacheConfig = await determineCacheConfig(url.toString());

      // Add the options to diagnosticsInfo
      diagnosticsInfo.transformParams = options as Record<
        string,
        string | number | boolean | null | undefined
      >;

      debug('TransformImageCommand', 'Cache configuration', {
        url: url.toString(),
        cacheConfig: cacheConfig as unknown as Record<string, unknown>,
      });

      // Set up the image resizing options for Cloudflare
      const imageResizingOptions = this.prepareImageResizingOptions(options);

      // Fetch the image with resizing options - match main branch behavior
      let response;
      try {
        // Create request options for fetch
        const cfProperties: Record<string, unknown> = {
          image: imageResizingOptions,
        };

        // Get cache config if available from context
        const configObject = this.context.config as {
          cache?: {
            cacheability?: boolean;
            ttl?: { ok?: number };
            imageCompression?: string;
            mirage?: boolean;
          };
        };
        if (configObject?.cache) {
          // Add cache-related properties
          cfProperties.polish = configObject.cache.imageCompression || 'off';
          cfProperties.mirage = configObject.cache.mirage || false;
          cfProperties.cacheEverything = configObject.cache.cacheability || false;
          if (configObject.cache.ttl?.ok) {
            cfProperties.cacheTtl = configObject.cache.ttl.ok;
          }
        }

        // Create fetch options
        const fetchOptions: RequestInit = {
          cf: cfProperties,
        };

        // Perform the fetch with enhanced options
        response = await fetch(request, fetchOptions);

        // Log details about the response for debugging
        debug('TransformImageCommand', 'Image fetch response', {
          url: request.url,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
      } catch (fetchErr) {
        // Enhanced error handling matching the main branch
        error('TransformImageCommand', 'Error fetching image', {
          error: fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error',
          stack: fetchErr instanceof Error ? fetchErr.stack : undefined,
        });

        // Rethrow to be handled by outer try/catch
        throw fetchErr;
      }

      // Calculate processing time
      diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);

      // Add debug headers if debug is enabled
      if (this.context.debugInfo?.isEnabled) {
        // Import debug service functions dynamically to avoid circular dependencies
        const { addDebugHeaders } = await import('../../services/debugService');
        return addDebugHeaders(response, this.context.debugInfo, diagnosticsInfo);
      }

      return response;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorType = err instanceof Error ? err.constructor.name : 'UnknownError';
      const statusCode = this.determineErrorStatusCode(err);

      error('TransformImageCommand', 'Error transforming image', {
        error: errorMessage,
        stack: errorStack,
        errorType,
        statusCode,
        url: this.context.request.url,
      });

      // Add error to diagnostics
      if (!Array.isArray(diagnosticsInfo.errors)) {
        diagnosticsInfo.errors = [];
      }
      diagnosticsInfo.errors.push(errorMessage);

      // Calculate processing time
      diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);

      // Create enhanced error response with proper status code
      const errorResponse = new Response(`Error transforming image: ${errorMessage}`, {
        status: statusCode,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Error-Type': errorType,
        },
      });

      return errorResponse;
    }
  }

  /**
   * Determine the appropriate HTTP status code based on the error type
   * @param error The error object
   * @returns Appropriate HTTP status code
   */
  private determineErrorStatusCode(error: unknown): number {
    // Default to 500 Internal Server Error
    if (!(error instanceof Error)) {
      return 500;
    }

    // Handle different error types
    if (
      error.message.includes('not found') ||
      error.message.includes('does not exist') ||
      error.message.toLowerCase().includes('404')
    ) {
      return 404;
    }

    if (
      error.message.includes('invalid') ||
      error.message.includes('must be') ||
      error.message.includes('expected')
    ) {
      return 400;
    }

    if (
      error.message.includes('forbidden') ||
      error.message.includes('not authorized') ||
      error.message.toLowerCase().includes('permission')
    ) {
      return 403;
    }

    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 504;
    }

    // Check for custom status code property
    if (
      'statusCode' in error &&
      typeof (error as Record<string, unknown>).statusCode === 'number'
    ) {
      return (error as Record<string, unknown>).statusCode as number;
    }

    // Default to 500 Internal Server Error
    return 500;
  }

  private validateOptions(options: ImageTransformOptions): void {
    // Define interface for validation configuration
    interface ValidationConfig {
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

    // Access validation config from context
    const config = this.context.config as Record<string, unknown>;
    const validation = (config.validation as ValidationConfig) || {
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
    };

    // Validate width
    if (options.width !== null && options.width !== undefined && options.width !== 'auto') {
      const width = Number(options.width);
      const minWidth = validation.minWidth || 10;
      const maxWidth = validation.maxWidth || 8192;

      if (isNaN(width) || width < minWidth || width > maxWidth) {
        throw new Error(`Width must be between ${minWidth} and ${maxWidth} pixels or "auto"`);
      }
    }

    // Validate height
    if (options.height !== null && options.height !== undefined) {
      const minHeight = validation.minHeight || 10;
      const maxHeight = validation.maxHeight || 8192;

      if (options.height < minHeight || options.height > maxHeight) {
        throw new Error(`Height must be between ${minHeight} and ${maxHeight} pixels`);
      }
    }

    // Validate quality
    if (options.quality !== null && options.quality !== undefined) {
      const minQuality = validation.minQuality || 1;
      const maxQuality = validation.maxQuality || 100;

      if (options.quality < minQuality || options.quality > maxQuality) {
        throw new Error(`Quality must be between ${minQuality} and ${maxQuality}`);
      }
    }

    // Validate fit
    const validFit = validation.fit || ['scale-down', 'contain', 'cover', 'crop', 'pad'];
    if (options.fit && !validFit.includes(options.fit)) {
      throw new Error(`Invalid fit: ${options.fit}. Must be one of: ${validFit.join(', ')}`);
    }

    // Validate format
    const validFormats = validation.format || [
      'auto',
      'webp',
      'avif',
      'json',
      'jpeg',
      'png',
      'gif',
    ];
    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(
        `Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`
      );
    }

    // Validate metadata
    const validMetadata = validation.metadata || ['keep', 'copyright', 'none'];
    if (options.metadata && !validMetadata.includes(options.metadata)) {
      throw new Error(
        `Invalid metadata: ${options.metadata}. Must be one of: ${validMetadata.join(', ')}`
      );
    }

    // Validate gravity
    const validGravity = validation.gravity || [
      'auto',
      'center',
      'top',
      'bottom',
      'left',
      'right',
      'face',
    ];
    if (options.gravity && !validGravity.includes(options.gravity)) {
      throw new Error(
        `Invalid gravity: ${options.gravity}. Must be one of: ${validGravity.join(', ')}`
      );
    }
  }

  /**
   * Prepare the Cloudflare image resizing options object
   * Based on main branch implementation in fetchWithImageOptions
   */
  private prepareImageResizingOptions(
    options: ImageTransformOptions
  ): Record<string, string | number | boolean | null | undefined> {
    // Create a copy of options for the cf.image object
    // This matches the behavior in the main branch
    const imageOptions = { ...options };

    // Remove non-Cloudflare options
    const nonCloudflareOptions = ['source', 'derivative'];
    nonCloudflareOptions.forEach((opt) => {
      delete imageOptions[opt as keyof typeof imageOptions];
    });

    // Special handling for width=auto since Cloudflare API doesn't support 'auto' directly
    if (imageOptions.width === 'auto') {
      debug('TransformImageCommand', 'Width=auto detected, not including width parameter', {
        url: this.context.request.url,
        options: options,
      });
      // Remove the width parameter entirely if it's still 'auto'
      // It should have been converted to a number by imageOptionsService
      delete imageOptions.width;
    }

    // Only include defined parameters
    const resizingOptions: Record<string, string | number | boolean | null | undefined> = {};
    Object.entries(imageOptions).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        resizingOptions[key] = value;
      }
    });

    return resizingOptions;
  }
}
