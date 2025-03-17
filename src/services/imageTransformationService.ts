/**
 * Service for transforming images using Cloudflare Image Resizing
 * Abstracts the command pattern implementation behind a service interface
 */
import { DebugInfo } from '../types/utils/debug';
import {
  ImageTransformOptions,
  ImageTransformationDependencies,
  IImageTransformationService,
} from '../types/services/image';
import { PathPattern } from '../types/utils/path';

/**
 * Transform an image using Cloudflare Image Resizing
 *
 * @deprecated Use createImageTransformationService factory function instead
 * @param request - The original request
 * @param options - Image transformation options
 * @param pathPatterns - Path patterns for matching URLs
 * @param debugInfo - Debug information settings
 * @param config - Environment configuration
 * @returns A response containing the transformed image
 */
export async function transformImage(
  request: Request,
  options: ImageTransformOptions,
  pathPatterns: PathPattern[] = [],
  debugInfo?: DebugInfo,
  config?: unknown
): Promise<Response> {
  try {
    // Import logging utilities
    const { debug, error } = await import('../utils/loggerUtils');

    debug('ImageTransformationService', 'Transforming image', {
      url: request.url,
      options,
    });

    // Import dynamically to avoid circular dependencies
    const { TransformImageCommand } = await import('../domain/commands/TransformImageCommand');

    // Create and execute the command
    const command = new TransformImageCommand({
      request,
      options,
      pathPatterns,
      debugInfo,
      config: config || {},
    });

    return await command.execute();
  } catch (err: unknown) {
    // Import logging utilities
    const { error } = await import('../utils/loggerUtils');

    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error('ImageTransformationService', 'Error transforming image', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    });

    throw err; // Rethrow to be handled by the caller
  }
}

/**
 * Get the format to use for the transformed image
 *
 * @deprecated Use createImageTransformationService factory function instead
 * @param request - The original request
 * @returns The best format based on Accept header
 */
export function getBestImageFormat(request: Request): string {
  // Get Accept header
  const accept = request.headers.get('Accept') || '';

  // Check for specific image formats in Accept header
  if (accept.includes('image/avif')) {
    return 'avif';
  } else if (accept.includes('image/webp')) {
    return 'webp';
  } else if (accept.includes('image/png')) {
    return 'png';
  } else if (accept.includes('image/jpeg')) {
    return 'jpeg';
  }

  // Default to auto to let Cloudflare decide
  return 'auto';
}

/**
 * Determine if responsive sizing should be used
 *
 * @deprecated Use createImageTransformationService factory function instead
 * @param width - Requested width
 * @param clientHintsAvailable - Whether client hints are available
 * @returns Whether to use responsive sizing
 */
export function shouldUseResponsiveSizing(
  width: string | number | null | undefined,
  clientHintsAvailable: boolean
): boolean {
  // Use responsive sizing if width is auto or not specified and client hints are available
  return (width === 'auto' || width === undefined || width === null) && clientHintsAvailable;
}

/**
 * Factory function to create an image transformation service with dependency injection
 * @param dependencies - Dependencies to inject into the service
 * @returns Image transformation service instance
 */
export function createImageTransformationService(
  dependencies: ImageTransformationDependencies
): IImageTransformationService {
  return {
    /**
     * Transform an image using Cloudflare Image Resizing
     */
    async transformImage(
      request: Request,
      options: ImageTransformOptions,
      pathPatterns: PathPattern[] = [],
      debugInfo?: DebugInfo,
      config?: unknown
    ): Promise<Response> {
      try {
        const { debug, error } = dependencies.logger;

        debug('ImageTransformationService', 'Transforming image', {
          url: request.url,
          options,
        });

        // Import dynamically to avoid circular dependencies
        const { createTransformImageCommand } = await import(
          '../domain/commands/TransformImageCommand'
        );

        // Create and execute the command using the factory function with DI
        const command = createTransformImageCommand(
          {
            request,
            options,
            pathPatterns,
            debugInfo,
            config: config || {},
          },
          {
            logger: {
              debug,
              error,
            },
            // Only provide the required dependencies, let the command load the rest dynamically
            cacheUtils: {
              determineCacheConfig: async (url: string) => ({
                cacheability: true,
                ttl: { ok: 86400 },
                method: 'cache-api',
              }),
            },
            clientDetection: {
              hasCfDeviceType: () => false,
              getCfDeviceType: () => 'desktop',
              hasClientHints: () => false,
              getDeviceTypeFromUserAgent: () => 'desktop',
              normalizeDeviceType: (type) => type,
            },
          }
        );

        return await command.execute();
      } catch (err: unknown) {
        const { error } = dependencies.logger;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        error('ImageTransformationService', 'Error transforming image', {
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });

        throw err; // Rethrow to be handled by the caller
      }
    },

    /**
     * Get the format to use for the transformed image
     */
    getBestImageFormat(request: Request): string {
      // Get Accept header
      const accept = request.headers.get('Accept') || '';

      // Check for specific image formats in Accept header
      if (accept.includes('image/avif')) {
        return 'avif';
      } else if (accept.includes('image/webp')) {
        return 'webp';
      } else if (accept.includes('image/png')) {
        return 'png';
      } else if (accept.includes('image/jpeg')) {
        return 'jpeg';
      }

      // Default to auto to let Cloudflare decide
      return 'auto';
    },
  };
}
