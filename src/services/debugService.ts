/**
 * Service for providing debugging capabilities for the image resizer
 * Handles debug headers, reports, and diagnostic information
 *
 * This file re-exports functions from the centralized logging utility for backward compatibility.
 * New code should use the factory function to create a properly injected debug service.
 */
import {
  extractRequestHeaders as extractRequestHeadersUtil,
  addDebugHeaders as addDebugHeadersUtil,
  createDebugReport as createDebugReportUtil,
} from '../utils/loggerUtils';

import {
  DebugInfo,
  DiagnosticsInfo,
  IDebugService,
  DebugServiceDependencies,
} from '../types/utils/debug';

// Re-export the types for backward compatibility
export type { DebugInfo, DiagnosticsInfo };

/**
 * @deprecated Use createDebugService factory function instead
 */
export const extractRequestHeaders = extractRequestHeadersUtil;

/**
 * @deprecated Use createDebugService factory function instead
 */
export const addDebugHeaders = addDebugHeadersUtil;

/**
 * @deprecated Use createDebugService factory function instead
 */
export const createDebugReport = createDebugReportUtil;

/**
 * Factory function to create a debug service with dependency injection
 * @param dependencies - Dependencies for the debug service
 * @returns Debug service implementation
 */
export function createDebugService(dependencies: DebugServiceDependencies): IDebugService {
  return {
    /**
     * Extract headers from a request for debugging
     */
    extractRequestHeaders(request: Request): Record<string, string> {
      return extractRequestHeadersUtil(request);
    },

    /**
     * Adds debug headers to a response based on diagnostic information
     */
    addDebugHeaders(
      response: Response,
      debugInfo: DebugInfo,
      diagnosticsInfo: DiagnosticsInfo
    ): Response {
      try {
        // If debug is not enabled, return the original response
        if (!debugInfo.isEnabled) {
          return response;
        }

        // Use the utility function
        const enhancedResponse = addDebugHeadersUtil(response, debugInfo, diagnosticsInfo);

        // Log debug headers if requested
        dependencies.logger.debug('DebugService', 'Added debug headers', {
          headers: [...enhancedResponse.headers.entries()].filter(
            ([key]) => key.startsWith('debug-') || key.startsWith('x-')
          ),
        });

        return enhancedResponse;
      } catch (err) {
        // On error, return the original response
        return response;
      }
    },

    /**
     * Creates an HTML debug report from diagnostics information
     */
    createDebugReport(diagnosticsInfo: DiagnosticsInfo): string {
      return createDebugReportUtil(diagnosticsInfo);
    },
  };
}
