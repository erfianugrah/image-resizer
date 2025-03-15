/**
 * Client hints utility functions
 */

import { debug as _debug } from './loggerUtils';

/**
 * Check if a request has client hints
 * @param request The request to check
 * @returns Whether the request has client hints
 */
export function hasClientHints(request: Request): boolean {
  // Check for common client hints headers
  const hasViewportWidth = !!request.headers.get('Sec-CH-Viewport-Width');
  const hasDpr = !!request.headers.get('Sec-CH-DPR');
  const hasWidth = !!request.headers.get('Width');

  return hasViewportWidth || hasDpr || hasWidth;
}

/**
 * Get viewport width from client hints
 * @param request The request to extract viewport width from
 * @returns Viewport width or null if not available
 */
export function getViewportWidth(request: Request): number | null {
  const viewportWidth = request.headers.get('Sec-CH-Viewport-Width');

  if (viewportWidth) {
    const width = parseInt(viewportWidth, 10);
    if (!isNaN(width)) {
      return width;
    }
  }

  // Try legacy width header
  const width = request.headers.get('Width');
  if (width) {
    const parsedWidth = parseInt(width, 10);
    if (!isNaN(parsedWidth)) {
      return parsedWidth;
    }
  }

  return null;
}

/**
 * Get device pixel ratio from client hints
 * @param request The request to extract DPR from
 * @returns Device pixel ratio or null if not available
 */
export function getDevicePixelRatio(request: Request): number | null {
  const dpr = request.headers.get('Sec-CH-DPR');

  if (dpr) {
    const ratio = parseFloat(dpr);
    if (!isNaN(ratio)) {
      return ratio;
    }
  }

  return null;
}

/**
 * Get network quality from client hints
 * Implements a simple heuristic for network quality based on headers
 * @param request The request to check
 * @returns Network quality information
 */
export function getNetworkQuality(request: Request): { quality: string; bandwidth?: number } {
  // Check if we have the Save-Data header
  const saveData = request.headers.get('Save-Data');
  if (saveData === 'on') {
    return { quality: 'slow' };
  }

  // Check for network information in client hints
  const downlink = request.headers.get('Downlink');
  const rtt = request.headers.get('RTT');

  if (downlink && rtt) {
    const bandwidth = parseFloat(downlink);
    const roundTripTime = parseInt(rtt, 10);

    if (!isNaN(bandwidth) && !isNaN(roundTripTime)) {
      // Determine network quality
      if (bandwidth < 0.5 || roundTripTime > 1000) {
        return { quality: 'slow', bandwidth };
      } else if (bandwidth < 2 || roundTripTime > 400) {
        return { quality: 'medium', bandwidth };
      } else if (bandwidth < 10 || roundTripTime > 100) {
        return { quality: 'fast', bandwidth };
      } else {
        return { quality: 'ultrafast', bandwidth };
      }
    }
  }

  // Default to medium if we can't determine
  return { quality: 'medium' };
}
