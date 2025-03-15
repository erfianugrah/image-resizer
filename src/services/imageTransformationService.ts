/**
 * Service for transforming images using Cloudflare Image Resizing
 * Abstracts the command pattern implementation behind a service interface
 */
import { ImageTransformOptions } from '../domain/commands/TransformImageCommand';
import { PathPattern } from '../utils/pathUtils';
import { DebugInfo } from '../utils/debugHeadersUtils';
import { debug, error } from '../utils/loggerUtils';

/**
 * Transform an image using Cloudflare Image Resizing
 *
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
