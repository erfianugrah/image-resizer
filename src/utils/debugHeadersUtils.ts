/**
 * Debug headers utilities
 */
import { debug } from './loggerUtils';

// Debug info type
export interface DebugInfo {
  isEnabled: boolean;
  isVerbose?: boolean;
  includeHeaders?: string[];
  includePerformance?: boolean;
}

/**
 * Add debug headers to a response
 * 
 * @param response - Original response
 * @param debugInfo - Debug information
 * @param options - Image options
 * @returns Response with debug headers
 */
export function addDebugHeaders(
  response: Response,
  debugInfo: DebugInfo,
  options: Record<string, any>
): Response {
  if (!debugInfo.isEnabled) {
    return response;
  }

  // Clone response to modify headers
  const enhancedResponse = new Response(response.body, response);
  const headers = enhancedResponse.headers;

  // Add image resizing parameters
  if (options.irOptions) {
    headers.set('debug-ir', JSON.stringify(options.irOptions));
  }

  // Add cache configuration
  if (options.cacheConfig) {
    headers.set('debug-cache', JSON.stringify(options.cacheConfig));
  }

  // Add deployment mode
  if (options.mode) {
    headers.set('debug-mode', JSON.stringify({
      mode: options.mode,
      ...(options.requestTransform || {})
    }));
  }

  // Add client hints
  if (options.clientHints) {
    headers.set('debug-client-hints', JSON.stringify(options.clientHints));
  }

  // Add user agent
  if (options.userAgent) {
    headers.set('debug-ua', options.userAgent);
  }

  // Add device info
  if (options.device) {
    headers.set('debug-device', JSON.stringify(options.device));
  }

  // Add specific processing headers
  if (options.sizeSource) {
    headers.set('x-size-source', options.sizeSource);
  }

  if (options.actualWidth) {
    headers.set('x-actual-width', options.actualWidth.toString());
  }

  if (options.processingMode) {
    headers.set('x-processing-mode', options.processingMode);
  }

  if (options.responsiveSizing !== undefined) {
    headers.set('x-responsive-sizing', options.responsiveSizing.toString());
  }

  debug('DebugHeaders', 'Added debug headers', {
    headers: [...headers.entries()].filter(([key]) => key.startsWith('debug-') || key.startsWith('x-'))
  });

  return enhancedResponse;
}