/**
 * Enhanced Debug Headers Implementation
 * 
 * Add this utility to improve debug headers for transformation strategies
 */

// Import necessary types
import { IImageTransformationStrategy } from '../types/services/streaming';
import { IEnvironmentService } from '../services/environmentService';
import { ILogger } from '../types/core/logger';

/**
 * Add strategy debug headers to response
 * @param response The response to enhance
 * @param request The original request
 * @param usedStrategy The strategy that was used
 * @param attemptedStrategies List of strategies that were attempted
 * @param environmentService The environment service (optional)
 * @param logger Logger instance
 * @returns Enhanced response with debug headers
 */
export function addStrategyDebugHeaders(
  response: Response,
  request: Request,
  usedStrategy: string,
  attemptedStrategies: string[],
  environmentService?: IEnvironmentService | null,
  logger?: ILogger | null
): Response {
  try {
    const debugHeaders = new Headers(response.headers);
    const url = new URL(request.url);

    // Add basic strategy debug headers
    debugHeaders.set('debug-strategy-used', usedStrategy);
    debugHeaders.set('debug-strategy-attempts', attemptedStrategies.join(','));
    
    // Add environment info if available
    if (environmentService) {
      try {
        // Get environment details
        const environment = environmentService.getEnvironmentName();
        const isDev = environmentService.isDevelopment();
        
        // Get strategy configuration for this URL
        const priorityOrder = environmentService.getStrategyPriorityOrderForUrl(url.toString());
        const interceptorEnabled = environmentService.isStrategyEnabledForUrl('interceptor', url.toString());
        const cdnCgiEnabled = environmentService.isStrategyEnabledForUrl('cdn-cgi', url.toString());
        
        // Add environment info headers
        debugHeaders.set('debug-environment', environment);
        debugHeaders.set('debug-domain-type', url.hostname.includes('workers.dev') ? 'workers.dev' : 'custom');
        
        // Add strategy configuration headers
        debugHeaders.set('debug-strategy-priority', priorityOrder.join(','));
        debugHeaders.set('debug-interceptor-enabled', String(interceptorEnabled));
        debugHeaders.set('debug-cdncgi-enabled', String(cdnCgiEnabled));
      } catch (error) {
        // Log error but continue
        if (logger) {
          logger.debug('DebugHeaders', 'Error adding environment debug headers', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    // Add some request context
    debugHeaders.set('debug-via-header', request.headers.get('via') || 'none');
    debugHeaders.set('debug-url-pathname', url.pathname);
    
    // Create a new response with the enhanced headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: debugHeaders,
    });
  } catch (error) {
    // If anything goes wrong, just return the original response
    if (logger) {
      logger.error('DebugHeaders', 'Error adding strategy debug headers', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    return response;
  }
}

/**
 * Usage example in the stream transformation service:
 * 
 * import { addStrategyDebugHeaders } from '../utils/debugHeaders';
 * 
 * // In the strategy chain execution:
 * const result = await strategy.execute(params);
 * const enhancedResponse = addStrategyDebugHeaders(
 *   result,
 *   params.request,
 *   strategy.name,
 *   attempts,
 *   environmentService,
 *   logger
 * );
 * return enhancedResponse;
 */