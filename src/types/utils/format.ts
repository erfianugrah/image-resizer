/**
 * Format utilities interfaces
 */

/**
 * Interface for format utility service
 */
export interface IFormatUtils {
  /**
   * Determine optimal image format based on Accept header and parameters
   * @param request - The incoming request
   * @param formatParam - Format parameter from URL
   * @returns Optimal image format
   */
  determineFormat(request: Request, formatParam: string | null): string;

  /**
   * Get content type based on format
   * @param format - Image format
   * @returns Content type header value
   */
  getContentTypeForFormat(format: string): string;
}

/**
 * Dependencies for format utilities factory
 */
export interface FormatUtilsDependencies {
  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
  };

  /**
   * Optional client detection utilities for format detection
   */
  clientDetectionUtils?: {
    getOptimalFormat: (userAgent: string, accept: string | null) => string;
  };
}
