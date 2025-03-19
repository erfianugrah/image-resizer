/**
 * Example Cloudflare Worker that uses the Interceptor Strategy pattern
 * for R2 image transformations
 */
import { createStreamingTransformationService } from '../../src/services/streamingTransformationService';
import { createLogger } from '../../src/core/logger';

// Define environment interface
interface Env {
  // R2 bucket binding
  IMAGES: R2Bucket;
  // Optional environment variables
  FALLBACK_URL?: string;
  DEBUG?: string;
}

export default {
  /**
   * Main request handler
   */
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Create a basic logger
    const logger = createLogger('r2-worker');

    // Parse the URL and path
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if the path matches our image pattern
    if (!path.startsWith('/images/')) {
      return new Response('Not Found', { status: 404 });
    }

    // Extract the image key from the path
    const imageKey = path.replace('/images/', '');

    // Check for the "via" header to detect image resizing subrequests
    const viaHeader = request.headers.get('via') || '';
    const isImageResizingSubrequest = viaHeader.includes('image-resizing');

    // SIMPLIFIED APPROACH: If this is a resizing subrequest, serve the original image directly
    if (isImageResizingSubrequest) {
      logger.debug('Detected image resizing subrequest', {
        via: viaHeader,
        key: imageKey,
      });

      // Get the object from R2
      const object = await env.IMAGES.get(imageKey);

      // Return 404 if not found
      if (object === null) {
        return new Response('Image not found', { status: 404 });
      }

      // Create response headers
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('Cache-Control', 'public, max-age=86400');
      headers.set('X-Source', 'r2-direct-subrequest');

      // Return the original image to be transformed by Cloudflare
      return new Response(object.body, {
        headers,
      });
    }

    // SIMPLIFIED APPROACH: For initial requests, just apply transform directly
    if (
      url.searchParams.has('width') ||
      url.searchParams.has('height') ||
      url.searchParams.has('fit') ||
      url.searchParams.has('format')
    ) {
      // Extract width parameter (this is just a simple example)
      const width = url.searchParams.get('width') ? parseInt(url.searchParams.get('width')) : null;

      // Get the object to ensure it exists before transformation
      const object = await env.IMAGES.get(imageKey);
      if (object === null) {
        return new Response('Image not found', { status: 404 });
      }

      // Apply Cloudflare transformation directly
      // This will trigger a subrequest back to this worker
      return fetch(request.url, {
        cf: {
          image: {
            width, // Pass other options here as needed
          },
          cacheEverything: true,
          cacheTtl: 86400,
        },
      });
    }

    // For requests with no transformation parameters, use our streaming service

    // Extract transformation parameters from URL
    // Using responsive sizing for images without explicit parameters
    const width = 800; // Default width if none specified
    const format = null; // Let Cloudflare determine best format
    const fit = 'cover';
    const quality = 80;

    // Create image options object
    const imageOptions = {
      width,
      format,
      fit,
      quality,
    };

    // Create cache config
    const cacheConfig = {
      cacheability: true,
      ttl: {
        ok: 86400, // 1 day in seconds
      },
    };

    try {
      // Create a minimal cache implementation
      const minimalCache = {
        determineCacheControl: (status: number) => {
          if (status === 200) {
            return 'public, max-age=86400';
          } else if (status >= 400 && status < 500) {
            return 'public, max-age=60';
          } else {
            return 'no-store';
          }
        },
      };

      // Create the streaming transformation service
      const transformationService = createStreamingTransformationService({
        logger,
        cache: minimalCache,
      });

      // Process the image using our service
      // The service will use the InterceptorStrategy which will create
      // a subrequest back to this worker
      return await transformationService.processR2Image(
        imageKey,
        env.IMAGES,
        imageOptions,
        request,
        cacheConfig,
        env.FALLBACK_URL
      );
    } catch (error) {
      // Log any errors
      logger.error('Error processing image', {
        error: error instanceof Error ? error.message : String(error),
        key: imageKey,
        url: request.url,
      });

      // Return an error response
      return new Response(
        `Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  },
};
