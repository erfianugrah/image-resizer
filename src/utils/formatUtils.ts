/**
 * Determine optimal image format based on Accept header and parameters
 * @param request - The incoming request
 * @param formatParam - Format parameter from URL
 * @returns Optimal image format
 */
export function determineFormat(request: Request, formatParam: string | null): string {
  // If format is explicitly specified, use that
  if (formatParam && formatParam !== 'auto') return formatParam;

  // Otherwise determine from Accept header
  const accept = request.headers.get('Accept') || '';

  // Define format checks in order of preference
  const formatChecks = [
    { regex: /image\/avif/, format: 'avif' },
    { regex: /image\/webp/, format: 'webp' },
  ];

  // Find the first supported format
  const supportedFormat = formatChecks.find((check) => check.regex.test(accept));

  // Return the supported format or default to AVIF
  return supportedFormat ? supportedFormat.format : 'avif';
}

/**
 * Get content type based on format
 * @param format - Image format
 * @returns Content type header value
 */
export function getContentTypeForFormat(format: string): string {
  const contentTypeMap: Record<string, string> = {
    avif: 'image/avif',
    webp: 'image/webp',
    png: 'image/png',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
  };

  return contentTypeMap[format.toLowerCase()] || 'image/jpeg';
}
