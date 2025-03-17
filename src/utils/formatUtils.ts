import { IFormatUtils, FormatUtilsDependencies } from '../types/utils/format';

/**
 * Create format utilities service
 * @param dependencies - Dependencies for format utilities
 * @returns Format utilities implementation
 */
export function createFormatUtils(dependencies: FormatUtilsDependencies = {}): IFormatUtils {
  const { logger, clientDetectionUtils } = dependencies;

  /**
   * Log debug message with context data
   * @param message - Debug message
   * @param data - Context data
   */
  const logDebug = (message: string, data?: Record<string, unknown>): void => {
    if (logger?.debug) {
      logger.debug('FormatUtils', message, data);
    }
  };

  /**
   * Determine optimal image format based on Accept header and parameters
   * @param request - The incoming request
   * @param formatParam - Format parameter from URL
   * @returns Optimal image format
   */
  function determineFormat(request: Request, formatParam: string | null): string {
    // If format is explicitly specified, use that
    if (formatParam && formatParam !== 'auto') {
      logDebug('Using specified format', { formatParam });
      return formatParam;
    }

    // Try using clientDetectionUtils if available
    if (clientDetectionUtils) {
      const userAgent = request.headers.get('User-Agent') || '';
      const accept = request.headers.get('Accept') || '';

      const format = clientDetectionUtils.getOptimalFormat(userAgent, accept);
      logDebug('Using clientDetectionUtils for format detection', {
        userAgent: userAgent.substring(0, 50) + '...',
        accept,
        detectedFormat: format,
      });

      return format;
    }

    // Fall back to basic Accept header detection
    const accept = request.headers.get('Accept') || '';

    // Define format checks in order of preference
    const formatChecks = [
      { regex: /image\/avif/, format: 'avif' },
      { regex: /image\/webp/, format: 'webp' },
    ];

    // Find the first supported format
    const supportedFormat = formatChecks.find((check) => check.regex.test(accept));
    const format = supportedFormat ? supportedFormat.format : 'avif';

    logDebug('Determined format from Accept header', { accept, format });
    return format;
  }

  /**
   * Get content type based on format
   * @param format - Image format
   * @returns Content type header value
   */
  function getContentTypeForFormat(format: string): string {
    const contentTypeMap: Record<string, string> = {
      avif: 'image/avif',
      webp: 'image/webp',
      png: 'image/png',
      gif: 'image/gif',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
    };

    const contentType = contentTypeMap[format.toLowerCase()] || 'image/jpeg';
    logDebug('Mapped format to content type', { format, contentType });

    return contentType;
  }

  return {
    determineFormat,
    getContentTypeForFormat,
  };
}

// Backward compatibility functions
// ------------------------------

/**
 * @deprecated Use createFormatUtils().determineFormat instead
 */
export function determineFormat(request: Request, formatParam: string | null): string {
  return createFormatUtils().determineFormat(request, formatParam);
}

/**
 * @deprecated Use createFormatUtils().getContentTypeForFormat instead
 */
export function getContentTypeForFormat(format: string): string {
  return createFormatUtils().getContentTypeForFormat(format);
}
