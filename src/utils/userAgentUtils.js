/**
 * Determine device type from User-Agent string
 * @param {string} userAgent - User-Agent header value
 * @returns {string} - Device type (mobile, tablet, desktop, large-desktop)
 */
export function getDeviceTypeFromUserAgent(userAgent = "") {
  // Define device type detection rules
  const deviceRules = [
    {
      regex: /mobile|android|iphone|ipod|webos|iemobile|opera mini/i,
      type: "mobile",
    },
    {
      regex: /ipad|tablet|playbook|silk/i,
      type: "tablet",
    },
    {
      regex: /macintosh|windows/i,
      extraCheck: () => /screen and \(min-width: 1440px\)/.test(userAgent),
      type: "large-desktop",
    },
  ];

  // Find matching device type
  for (const rule of deviceRules) {
    if (rule.regex.test(userAgent)) {
      // For large-desktop, we need an additional check
      if (rule.extraCheck && !rule.extraCheck()) {
        continue;
      }
      return rule.type;
    }
  }

  return "desktop"; // Default fallback
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

  // Define device type to minimum width mapping
  const deviceMinWidthMap = {
    "mobile": 320,
    "tablet": 768,
    "large-desktop": 1200,
    "desktop": isAutoRequested ? 1200 : 960, // Special case for desktop
  };

  // Get minimum width for the device type
  const minWidth = deviceMinWidthMap[deviceType] || deviceMinWidthMap.desktop;

  // For desktop, use exact width from map
  if (deviceType === "desktop") {
    return {
      width: minWidth,
      source: `ua-${deviceType}`,
    };
  }

  // For other devices, find the first width that meets or exceeds the minimum width
  // or fallback to the minimum width if none found
  const width = sortedWidths.find((w) => w >= minWidth) || minWidth;

  return {
    width,
    source: `ua-${deviceType}`,
  };
}
