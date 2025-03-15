/**
 * Image Processing Service
 * Handles the low-level interaction with Cloudflare's Image Resizing API
 */
import { generateCacheTags, CacheConfigRecord } from '../utils/cacheControlUtils';
import { debug, error, info } from '../utils/loggerUtils';
import { addDebugHeaders } from '../utils/debugHeadersUtils';
import { imageConfig } from '../config/imageConfig';

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  imageCompression?: 'off' | 'lossy' | 'lossless';
  mirage?: boolean;
  cacheability?: boolean;
  ttl?: {
    ok?: number;
    error?: number;
  };
  method?: string;
  debug?: boolean;
}

/**
 * Image processing options interface
 */
export interface ImageProcessingOptions {
  width?: string | number;
  height?: number | null;
  fit?: string | null;
  quality?: number | null;
  format?: string | null;
  dpr?: number | null;
  source?: string;
  derivative?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Debug information interface
 */
export interface DebugInformation {
  bucketName?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Response log utility function (since this was missing in loggerUtils)
 */
function logResponse(module: string, response: Response): void {
  info(module, `Response: ${response.status} ${response.statusText}`, {
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length'),
    cacheControl: response.headers.get('cache-control'),
  });
}

/**
 * Process the image using Cloudflare's Image Resizing
 * @param request - The incoming request
 * @param options - Image processing options
 * @param cache - Cache configuration
 * @param debugInfo - Debug information
 * @returns The processed image response
 */
export async function processImage(
  request: Request,
  options: ImageProcessingOptions,
  cache: CacheConfig,
  debugInfo: DebugInformation = {}
): Promise<Response> {
  debug('ImageProcessor', 'Processing image', {
    options,
    cache: cache as CacheConfigRecord,
    debugInfo,
  });

  // Handle 'auto' width - not supported in Workers API
  if (options.width === 'auto') {
    debug('ImageProcessor', 'width=auto is not supported in Workers API. Using responsive sizing.');

    // Use the breakpoints from config or default to empty array if not found
    const breakpoints = imageConfig.responsive?.breakpoints || [];

    // Instead of a fixed fallback, get a responsive width based on device type
    // Adjusting this call to match the actual function signature
    const responsiveWidth = getResponsiveWidth(request, breakpoints);

    // Update the options with the detected width
    options.width = responsiveWidth.width;

    // Keep track of the original source and add the fallback info
    const originalSource = options.source;
    options.source = `${originalSource}-fallback`;

    debug('ImageProcessor', 'Replaced auto width with responsive width', {
      originalWidth: 'auto',
      newWidth: options.width,
      detectionSource: responsiveWidth.source,
    });
  }

  // Make the request with our configured options
  const newResponse = await fetchWithImageOptions(request, options, cache, debugInfo);

  // Build the enhanced response with debug headers
  const response = buildResponse(request, newResponse, {
    options,
    cache,
    debugInfo,
  });

  // Log response details
  logResponse('ImageProcessor', response);

  // Return the response or fallback to original request if error
  return response.ok || response.redirected ? response : fetch(request);
}

/**
 * Fetch image with Cloudflare image resizing options
 * @param request - The incoming request
 * @param options - Image processing options
 * @param cache - Cache configuration
 * @param debugInfo - Debug information
 * @returns Cloudflare response
 */
async function fetchWithImageOptions(
  request: Request,
  options: ImageProcessingOptions,
  cache: CacheConfig,
  debugInfo: DebugInformation
): Promise<Response> {
  // Create a copy of options for the cf.image object
  const imageOptions = { ...options };

  // Remove non-Cloudflare options
  const nonCloudflareOptions = ['source', 'derivative'];
  nonCloudflareOptions.forEach((opt) => delete imageOptions[opt]);

  // Only include defined parameters to avoid sending empty/null values to Cloudflare API
  const cfImageOptions: Record<string, string | number | boolean> = {};
  Object.entries(imageOptions).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      cfImageOptions[key] = value;
    }
  });

  // Log request details
  debug('ImageProcessor', 'Preparing Cloudflare image resize fetch', {
    imageOptions: cfImageOptions,
    url: request.url,
  });

  try {
    const cacheTags = generateCacheTags(debugInfo.bucketName, options.derivative);

    // Create fetch options with CloudFlare-specific properties
    const fetchOptions: RequestInit & {
      cf?: {
        polish?: 'off' | 'lossy' | 'lossless';
        mirage?: boolean;
        cacheEverything?: boolean;
        cacheTtl?: number;
        image?: Record<string, string | number | boolean>;
        cacheTags?: string[];
      };
    } = {
      cf: {
        polish: (cache.imageCompression || 'off') as 'off' | 'lossy' | 'lossless',
        mirage: cache.mirage || false,
        cacheEverything: cache.cacheability || false,
        image: cfImageOptions,
      },
    };

    // Only add cache TTL if defined
    if (cache.ttl?.ok) {
      fetchOptions.cf!.cacheTtl = cache.ttl.ok;
    }

    // Add cache tags if they exist
    if (cacheTags && cacheTags.length > 0) {
      fetchOptions.cf!.cacheTags = cacheTags;
    }

    const response = await fetch(request, fetchOptions);

    info('ImageProcessor', 'Image processed successfully', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    return response;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;

    error('ImageProcessor', 'Error fetching image', {
      error: errorMessage,
      stack: errorStack,
    });

    return new Response(`Error processing image: ${errorMessage}`, {
      status: 500,
    });
  }
}

/**
 * Build the final response with appropriate headers
 * @param request - Original request
 * @param response - Original Cloudflare response
 * @param context - Context containing options, cache config, and debug info
 * @returns Final response with proper headers
 */
function buildResponse(
  request: Request,
  response: Response,
  context: {
    options: ImageProcessingOptions;
    cache: CacheConfig;
    debugInfo: DebugInformation;
  }
): Response {
  // Create new response to avoid mutating the original
  const newResponse = new Response(response.body, response);

  // Convert to the right format for addDebugHeaders
  const debugContext = {
    ...context.debugInfo,
    irOptions: context.options,
    cacheConfig: context.cache as CacheConfigRecord,
  };

  // Use addDebugHeaders to handle debug headers
  return addDebugHeaders(
    newResponse,
    {
      isEnabled: !!context.debugInfo.isDebugEnabled,
      isVerbose: !!context.debugInfo.isVerbose,
    },
    debugContext
  );
}

/**
 * Get responsive width based on request and breakpoints
 * This is a simple implementation to avoid circular dependencies
 */
function getResponsiveWidth(
  request: Request,
  breakpoints: number[]
): { width: number; source: string } {
  // Simple responsive width based on user agent
  const userAgent = request.headers.get('user-agent') || '';

  let width: number;
  let source: string;

  if (userAgent.includes('Mobile')) {
    width = 640;
    source = 'user-agent-mobile';
  } else if (userAgent.includes('Tablet')) {
    width = 1024;
    source = 'user-agent-tablet';
  } else {
    width = 1440;
    source = 'user-agent-desktop';
  }

  // Snap to breakpoint if provided
  if (breakpoints && breakpoints.length > 0) {
    // Find the closest breakpoint
    const closestBreakpoint = breakpoints.reduce((prev, curr) => {
      return Math.abs(curr - width) < Math.abs(prev - width) ? curr : prev;
    }, breakpoints[0]);

    width = closestBreakpoint;
  }

  return { width, source };
}
