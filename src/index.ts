/**
 * Image Resizer Worker
 *
 * This worker transforms image requests by using Cloudflare Image Resizing
 * to deliver optimized images with various transformations.
 *
 * - Run `npm run dev` to start a development server
 * - Run `npm run deploy` to publish your worker
 */

import { handleImageRequest } from './handlers/imageHandler';
import { initializeLogging } from './utils/loggingManager';
import { error, info, logRequest } from './utils/loggerUtils';
import { ConfigurationManager } from './config/configManager';

// Flag to track if initialization is complete
let isInitialized = false;

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // Initialize configuration and services if not already done
      if (!isInitialized) {
        // Initialize the configuration manager
        const configManager = ConfigurationManager.getInstance();
        configManager.initialize(env);
        const config = configManager.getConfig();

        // Initialize logging using our centralized manager
        initializeLogging(env);

        info(
          'Worker',
          `Initialized image-resizer v${config.version} in ${config.mode} mode with ${config.cache.method} caching`
        );

        isInitialized = true;
      }

      // Get current configuration
      const configManager = ConfigurationManager.getInstance();
      const config = configManager.getConfig();

      // Log incoming request at debug level
      logRequest('Request', request);

      // Define patterns to skip resizing
      // We skip only if this is a request from another image-resizing worker (prevent infinite loops)
      const skipPatterns = [(headers: Headers) => /image-resizing/.test(headers.get('via') || '')];

      // Check if request has width=auto parameter - main branch forces these to be processed
      const url = new URL(request.url);
      const hasWidthAuto =
        url.searchParams.has('width') && url.searchParams.get('width') === 'auto';

      // Check if request has a known image extension
      const hasImageExtension = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(url.pathname);

      // Check if request Accept header indicates it's an image request
      const acceptHeader = request.headers.get('Accept') || '';
      const isImageRequest = acceptHeader.includes('image/');

      // We skip processing only if:
      // 1. This is a loop-prevention case (image-resizing in via header), AND
      // 2. It's not a width=auto request (which should always be processed)
      const isLoopRequest = skipPatterns.some((pattern) => pattern(request.headers));
      const shouldSkip = isLoopRequest && !hasWidthAuto;

      // Log more details about request and config for debugging
      info('Worker', 'Processing request', {
        url: request.url,
        mode: config.mode,
        shouldSkip,
        hasWidthAuto,
        hasImageExtension,
        isImageRequest,
        isLoopRequest,
        headers: {
          accept: request.headers.get('Accept'),
          referer: request.headers.get('Referer'),
          userAgent: request.headers.get('User-Agent'),
          via: request.headers.get('Via'),
        },
      });

      // Process the request if it shouldn't be skipped
      if (!shouldSkip) {
        try {
          // Pass full config to the handler - it will extract what it needs
          return await handleImageRequest(request, config);
        } catch (handlerError) {
          error('Worker', 'Error in image handler', {
            error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
            stack: handlerError instanceof Error ? handlerError.stack : undefined,
          });
          // Rethrow to be caught by the outer try/catch
          throw handlerError;
        }
      }

      info('Worker', 'Skipping image processing, passing through request');
      return fetch(request); // pass-through and continue
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;

      error('Worker', 'Unexpected error in worker', {
        error: errorMessage,
        stack: errorStack,
      });

      return new Response('An unexpected error occurred', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
