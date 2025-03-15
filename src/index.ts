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
      const skipPatterns = [(headers: Headers) => /image-resizing/.test(headers.get('via') || '')];

      // Check if we should skip resizing
      const shouldSkip = skipPatterns.some((pattern) => pattern(request.headers));

      if (!shouldSkip) {
        // Pass full config to the handler - it will extract what it needs
        return await handleImageRequest(request, config);
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
