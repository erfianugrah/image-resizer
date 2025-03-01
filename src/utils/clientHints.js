/**
 * Get responsive width based on client hints headers
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object|null} - Width settings based on client hints or null if not available
 */
export function getWidthFromClientHints(request, responsiveWidths) {
  // We'll use the standard responsive widths from Cloudflare documentation if none provided
  const standardWidths = [320, 768, 960, 1200];
  const widthsToUse = responsiveWidths && responsiveWidths.length > 0
    ? responsiveWidths
    : standardWidths;

  // Ensure we have a sorted array of widths
  const sortedWidths = [...widthsToUse].sort((a, b) => a - b);

  // Check for client hints
  const viewportWidth = parseInt(request.headers.get("Sec-CH-Viewport-Width"));
  const dpr = parseFloat(request.headers.get("Sec-CH-DPR")) || 1;

  // Return null if client hints are not available
  if (!viewportWidth) {
    return null;
  }

  // Calculate ideal image width based on viewport width and device pixel ratio
  const idealWidth = Math.floor(viewportWidth * dpr);

  // Find the closest responsive width that's at least as large as the ideal width
  // or use the largest available if none are large enough
  const width = sortedWidths.find((w) => w >= idealWidth) ||
    sortedWidths[sortedWidths.length - 1];

  return {
    width,
    source: "client-hints",
  };
}
