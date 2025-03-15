/**
 * Command for transforming images using Cloudflare Image Resizing
 */
import { debug, error } from '../../utils/loggerUtils';
import { determineCacheConfig } from '../../utils/cacheUtils';
import { DebugInfo } from '../../utils/debugHeadersUtils';
import { PathPattern } from '../../utils/pathUtils';

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
}

export interface ImageTransformContext {
  request: Request;
  options: ImageTransformOptions;
  pathPatterns?: PathPattern[];
  debugInfo?: DebugInfo;
  config: any; // Environment configuration
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
    const diagnosticsInfo: any = {
      errors: [],
      warnings: [],
      originalUrl: this.context.request.url
    };
    
    try {
      // Extract context information
      const { request, options, config } = this.context;
      const url = new URL(request.url);
      
      // Validate options
      this.validateOptions(options);
      
      // Get cache configuration for the image URL
      const cacheConfig = determineCacheConfig(url.toString());
      
      debug('TransformImageCommand', 'Cache configuration', {
        url: url.toString(),
        cacheConfig,
      });
      
      // Set up the image resizing options for Cloudflare
      const imageResizingOptions = this.prepareImageResizingOptions(options);
      
      // Fetch the image with resizing options
      const response = await fetch(request, {
        cf: {
          image: imageResizingOptions
        }
      });
      
      // Calculate processing time
      diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);
      
      // Add debug headers if debug is enabled
      if (this.context.debugInfo?.isEnabled) {
        // Import debug service functions dynamically to avoid circular dependencies
        const { addDebugHeaders } = await import('../../services/debugService');
        return addDebugHeaders(
          response, 
          this.context.debugInfo, 
          diagnosticsInfo
        );
      }
      
      return response;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      
      error('TransformImageCommand', 'Error transforming image', {
        error: errorMessage,
        stack: errorStack,
      });
      
      // Add error to diagnostics
      diagnosticsInfo.errors = diagnosticsInfo.errors || [];
      diagnosticsInfo.errors.push(errorMessage);
      
      // Calculate processing time
      diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);

      // Create error response
      const errorResponse = new Response(`Error transforming image: ${errorMessage}`, {
        status: 500,
        headers: { 
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store'
        },
      });
      
      return errorResponse;
    }
  }

  /**
   * Validate image transformation options
   */
  private validateOptions(options: ImageTransformOptions): void {
    // Validate width
    if (options.width !== null && options.width !== undefined && options.width !== 'auto') {
      const width = Number(options.width);
      if (isNaN(width) || width < 10 || width > 8192) {
        throw new Error('Width must be between 10 and 8192 pixels or "auto"');
      }
    }

    // Validate height
    if (options.height !== null && options.height !== undefined) {
      if (options.height < 10 || options.height > 8192) {
        throw new Error('Height must be between 10 and 8192 pixels');
      }
    }

    // Validate quality
    if (options.quality !== null && options.quality !== undefined) {
      if (options.quality < 1 || options.quality > 100) {
        throw new Error('Quality must be between 1 and 100');
      }
    }

    // Validate fit
    const validFit = ['scale-down', 'contain', 'cover', 'crop', 'pad'];
    if (options.fit && !validFit.includes(options.fit)) {
      throw new Error(`Invalid fit: ${options.fit}. Must be one of: ${validFit.join(', ')}`);
    }

    // Validate format
    const validFormats = ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'];
    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(`Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`);
    }

    // Validate metadata
    const validMetadata = ['keep', 'copyright', 'none'];
    if (options.metadata && !validMetadata.includes(options.metadata)) {
      throw new Error(`Invalid metadata: ${options.metadata}. Must be one of: ${validMetadata.join(', ')}`);
    }

    // Validate gravity
    const validGravity = ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'];
    if (options.gravity && !validGravity.includes(options.gravity)) {
      throw new Error(`Invalid gravity: ${options.gravity}. Must be one of: ${validGravity.join(', ')}`);
    }
  }

  /**
   * Prepare the Cloudflare image resizing options object
   */
  private prepareImageResizingOptions(options: ImageTransformOptions): Record<string, any> {
    const resizingOptions: Record<string, any> = {};

    // Map our options to Cloudflare image resizing parameters
    if (options.width === 'auto') {
      // Handle 'auto' width separately - will use responsive sizing
    } else if (options.width !== null && options.width !== undefined) {
      resizingOptions.width = Number(options.width);
    }

    // Map other parameters
    const paramsToMap = [
      'height', 'fit', 'quality', 'format', 'dpr', 
      'metadata', 'gravity', 'sharpen', 'brightness', 'contrast'
    ];

    for (const param of paramsToMap) {
      const key = param as keyof ImageTransformOptions;
      if (options[key] !== null && options[key] !== undefined) {
        resizingOptions[param] = options[key];
      }
    }

    return resizingOptions;
  }
}