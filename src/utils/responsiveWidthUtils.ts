/**
 * Responsive width calculation utilities
 */

import { debug } from './loggerUtils';
import { getViewportWidth, getDevicePixelRatio } from './clientHints';
import { getCfDeviceType, getDeviceInfo } from './deviceUtils';
// Unused import removed: import { getDeviceTypeFromUserAgent } from './userAgentUtils';

// Default breakpoints for responsive images
const defaultBreakpoints = [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840];

// Default device widths
const defaultDeviceWidths = {
  mobile: 480,
  tablet: 768,
  desktop: 1440,
};

/**
 * Get responsive width based on client hints and device type
 * @param request The request to analyze
 * @param deviceType Device type (mobile, tablet, desktop)
 * @returns The calculated responsive width
 */
export function getResponsiveWidth(request: Request, deviceType: string): number {
  // First priority: Use client hints if available
  const viewportWidth = getViewportWidth(request);
  const dpr = getDevicePixelRatio(request) || 1;

  if (viewportWidth) {
    // Scale by device pixel ratio
    const responsiveWidth = Math.round(viewportWidth * dpr);
    debug('ResponsiveWidthUtils', 'Using client hints for width', {
      viewportWidth,
      dpr,
      responsiveWidth,
    });
    return snapToBreakpoint(responsiveWidth);
  }

  // Second priority: Use CF-Device-Type if available
  const cfDeviceType = getCfDeviceType(request);
  if (cfDeviceType) {
    const deviceInfo = getDeviceInfo(cfDeviceType);
    debug('ResponsiveWidthUtils', 'Using CF-Device-Type for width', {
      cfDeviceType,
      width: deviceInfo.width,
    });
    return deviceInfo.width;
  }

  // Third priority: Use the provided device type from User-Agent detection
  const deviceWidth =
    defaultDeviceWidths[deviceType as keyof typeof defaultDeviceWidths] ||
    defaultDeviceWidths.desktop;

  debug('ResponsiveWidthUtils', 'Using User-Agent device type for width', {
    deviceType,
    width: deviceWidth,
  });

  return deviceWidth;
}

/**
 * Snap a width to the nearest breakpoint
 * @param width Width to snap
 * @param breakpoints Optional breakpoints to use
 * @returns Snapped width
 */
export function snapToBreakpoint(
  width: number,
  breakpoints: number[] = defaultBreakpoints
): number {
  // Find the closest breakpoint
  if (width <= breakpoints[0]) {
    return breakpoints[0];
  }

  if (width >= breakpoints[breakpoints.length - 1]) {
    return breakpoints[breakpoints.length - 1];
  }

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const current = breakpoints[i];
    const next = breakpoints[i + 1];

    if (width >= current && width < next) {
      // Use the closer breakpoint
      return width - current < next - width ? current : next;
    }
  }

  // Default to the middle breakpoint if something went wrong
  return breakpoints[Math.floor(breakpoints.length / 2)];
}
