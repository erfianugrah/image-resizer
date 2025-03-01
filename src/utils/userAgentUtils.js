/**
 * Determine device type from User-Agent string
 * @param {string} userAgent - User-Agent header value
 * @returns {string} - Device type (mobile, tablet, desktop, large-desktop)
 */
export function getDeviceTypeFromUserAgent(userAgent = "") {
  if (/mobile|android|iphone|ipod|webos|iemobile|opera mini/i.test(userAgent)) {
    return "mobile";
  }

  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    return "tablet";
  }

  if (
    /macintosh|windows/i.test(userAgent) &&
    /screen and \(min-width: 1440px\)/.test(userAgent)
  ) {
    return "large-desktop";
  }

  return "desktop";
}

/**
 * Get recommended image width based on device type
 * @param {string} deviceType - Device type (mobile, tablet, desktop, large-desktop)
 * @param {boolean} isAutoRequested - Whether width=auto was explicitly requested
 * @param {number[]} availableWidths - Array of available widths
 * @returns {Object} - Width and source information
 */
export function getWidthForDeviceType(
  deviceType,
  isAutoRequested,
  availableWidths,
) {
  // Default widths based on Cloudflare's recommendations
  const standardWidths = [320, 768, 960, 1200];
  const sortedWidths = [...(availableWidths || standardWidths)].sort((a, b) =>
    a - b
  );

  let width;

  switch (deviceType) {
    case "mobile":
      width = sortedWidths.find((w) => w >= 320) || 320;
      break;
    case "tablet":
      width = sortedWidths.find((w) => w >= 768) || 768;
      break;
    case "large-desktop":
      width = sortedWidths.find((w) => w >= 1200) || 1200;
      break;
    default: // desktop or other
      width = isAutoRequested ? 1200 : 960; // Use 1200 for explicit auto, 960 for implicit
  }

  return {
    width,
    source: `ua-${deviceType}`,
  };
}
