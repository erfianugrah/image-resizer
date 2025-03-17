/**
 * Centralized client detection utilities
 * Consolidates client hints, device detection, and user agent parsing
 */

import {
  DeviceInfo,
  BrowserCapabilities,
  NetworkQuality,
  IClientDetectionUtils,
  ClientDetectionUtilsDependencies,
  defaultBreakpoints,
  defaultDeviceWidths,
} from '../types/utils/clientDetection';

// Re-export types and constants for backward compatibility
export type { DeviceInfo, BrowserCapabilities, NetworkQuality };
export { defaultBreakpoints, defaultDeviceWidths };

/**
 * Create client detection utilities service
 * @param dependencies - Dependencies for client detection utilities
 * @returns Client detection utilities implementation
 */
export function createClientDetectionUtils(
  dependencies: ClientDetectionUtilsDependencies = {}
): IClientDetectionUtils {
  const { logger } = dependencies;

  /**
   * Log debug message with context data
   * @param module - Module name
   * @param message - Debug message
   * @param data - Context data
   */
  const logDebug = (module: string, message: string, data?: Record<string, unknown>): void => {
    if (logger?.debug) {
      logger.debug(module, message, data);
    }
  };

  /**
   * Check if a request has client hints
   * @param request The request to check
   * @returns Whether the request has client hints
   */
  function hasClientHints(request: Request): boolean {
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
  function getViewportWidth(request: Request): number | null {
    const viewportWidth = request.headers.get('Sec-CH-Viewport-Width');

    if (viewportWidth) {
      const width = parseInt(viewportWidth, 10);
      if (!isNaN(width)) {
        logDebug('ClientDetection', 'Found viewport width in Sec-CH-Viewport-Width', { width });
        return width;
      }
    }

    // Try legacy width header
    const width = request.headers.get('Width');
    if (width) {
      const parsedWidth = parseInt(width, 10);
      if (!isNaN(parsedWidth)) {
        logDebug('ClientDetection', 'Found viewport width in Width header', { width: parsedWidth });
        return parsedWidth;
      }
    }

    logDebug('ClientDetection', 'No viewport width found in headers');
    return null;
  }

  /**
   * Get device pixel ratio from client hints
   * @param request The request to extract DPR from
   * @returns Device pixel ratio or null if not available
   */
  function getDevicePixelRatio(request: Request): number | null {
    const dpr = request.headers.get('Sec-CH-DPR');

    if (dpr) {
      const ratio = parseFloat(dpr);
      if (!isNaN(ratio)) {
        logDebug('ClientDetection', 'Found DPR in Sec-CH-DPR header', { dpr: ratio });
        return ratio;
      }
    }

    logDebug('ClientDetection', 'No DPR found in headers');
    return null;
  }

  /**
   * Get network quality from client hints
   * Implements a simple heuristic for network quality based on headers
   * @param request The request to check
   * @returns Network quality information
   */
  function getNetworkQuality(request: Request): NetworkQuality {
    // Check if we have the Save-Data header
    const saveData = request.headers.get('Save-Data');
    if (saveData === 'on') {
      logDebug('ClientDetection', 'Found Save-Data header, using slow quality');
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
        let quality: string;

        if (bandwidth < 0.5 || roundTripTime > 1000) {
          quality = 'slow';
        } else if (bandwidth < 2 || roundTripTime > 400) {
          quality = 'medium';
        } else if (bandwidth < 10 || roundTripTime > 100) {
          quality = 'fast';
        } else {
          quality = 'ultrafast';
        }

        logDebug('ClientDetection', `Network quality determined: ${quality}`, {
          bandwidth,
          roundTripTime,
          quality,
        });

        return { quality, bandwidth };
      }
    }

    // Default to medium if we can't determine
    logDebug('ClientDetection', 'No network information found, defaulting to medium quality');
    return { quality: 'medium' };
  }

  /**
   * Check if a request has the CF-Device-Type header
   * @param request The request to check
   * @returns Whether the request has CF-Device-Type
   */
  function hasCfDeviceType(request: Request): boolean {
    return !!request.headers.get('CF-Device-Type');
  }

  /**
   * Get the CF-Device-Type header value
   * @param request The request to get the device type from
   * @returns The device type or null if not available
   */
  function getCfDeviceType(request: Request): string | null {
    const deviceType = request.headers.get('CF-Device-Type');
    if (deviceType) {
      logDebug('ClientDetection', 'Found CF-Device-Type header', { deviceType });
    }
    return deviceType;
  }

  /**
   * Get device information based on device type
   * @param deviceType Device type string
   * @returns Device information
   */
  function getDeviceInfo(deviceType: string): DeviceInfo {
    deviceType = deviceType.toLowerCase();
    let deviceInfo: DeviceInfo;

    switch (deviceType) {
      case 'mobile':
        deviceInfo = {
          type: 'mobile',
          width: 480,
          height: 854,
          pixelRatio: 2,
        };
        break;
      case 'tablet':
        deviceInfo = {
          type: 'tablet',
          width: 768,
          height: 1024,
          pixelRatio: 1.5,
        };
        break;
      case 'desktop':
      default:
        deviceInfo = {
          type: 'desktop',
          width: 1440,
          pixelRatio: 1,
        };
        break;
    }

    logDebug('ClientDetection', `Device info for type: ${deviceType}`, { ...deviceInfo });
    return deviceInfo;
  }

  /**
   * Normalize a device type string
   * @param deviceType Device type string
   * @returns Normalized device type
   */
  function normalizeDeviceType(deviceType: string | null): string {
    if (!deviceType) {
      return 'desktop';
    }

    deviceType = deviceType.toLowerCase();
    let normalizedType: string;

    if (deviceType.includes('mobile') || deviceType === 'phone') {
      normalizedType = 'mobile';
    } else if (deviceType.includes('tablet')) {
      normalizedType = 'tablet';
    } else {
      normalizedType = 'desktop';
    }

    logDebug('ClientDetection', `Normalized device type '${deviceType}' to '${normalizedType}'`);
    return normalizedType;
  }

  /**
   * Get device type from a user agent string
   * @param userAgent User agent string
   * @returns Device type (mobile, tablet, desktop)
   */
  function getDeviceTypeFromUserAgent(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    let deviceType: string;

    // Check for mobile devices
    if (
      ua.includes('android') ||
      ua.includes('iphone') ||
      ua.includes('ipod') ||
      ua.includes('windows phone') ||
      ua.includes('blackberry')
    ) {
      // Check if it's a tablet
      if (
        ua.includes('ipad') ||
        ua.includes('tablet') ||
        (ua.includes('android') && !ua.includes('mobile'))
      ) {
        deviceType = 'tablet';
      } else {
        deviceType = 'mobile';
      }
    }
    // Check for tablets
    else if (
      ua.includes('ipad') ||
      ua.includes('tablet') ||
      ua.includes('playbook') ||
      ua.includes('silk')
    ) {
      deviceType = 'tablet';
    }
    // Default to desktop
    else {
      deviceType = 'desktop';
    }

    logDebug('ClientDetection', `Detected device type from UA: ${deviceType}`, {
      userAgentSnippet: ua.substring(0, 50) + '...',
    });

    return deviceType;
  }

  /**
   * Detect browser capabilities from user agent
   * @param userAgent User agent string
   * @returns Browser capabilities object
   */
  function detectBrowserCapabilities(userAgent: string): BrowserCapabilities {
    const ua = userAgent.toLowerCase();
    const capabilities: BrowserCapabilities = {
      avif: false,
      webp: false,
      mp4: true, // Almost all browsers support MP4
      webm: false,
    };

    // Detect browser name and version
    if (ua.includes('firefox/')) {
      capabilities.name = 'firefox';
      const match = ua.match(/firefox\/([0-9.]+)/);
      if (match) {
        capabilities.version = match[1];
        const version = parseInt(match[1], 10);
        capabilities.webp = version >= 65;
        capabilities.avif = version >= 86;
        capabilities.webm = version >= 4;
      }
    } else if (ua.includes('chrome/')) {
      capabilities.name = 'chrome';
      const match = ua.match(/chrome\/([0-9.]+)/);
      if (match) {
        capabilities.version = match[1];
        const version = parseInt(match[1], 10);
        capabilities.webp = version >= 32;
        capabilities.avif = version >= 85;
        capabilities.webm = version >= 6;
      }
    } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
      capabilities.name = 'safari';
      const match = ua.match(/version\/([0-9.]+)/);
      if (match) {
        capabilities.version = match[1];
        const version = parseInt(match[1], 10);
        capabilities.webp = version >= 14;
        capabilities.avif = false; // Safari doesn't support AVIF yet
        capabilities.webm = false; // Safari doesn't support WebM
      }
    } else if (ua.includes('edge/') || ua.includes('edg/')) {
      capabilities.name = 'edge';

      // New Edge (Chromium-based)
      if (ua.includes('edg/')) {
        const match = ua.match(/edg\/([0-9.]+)/);
        if (match) {
          capabilities.version = match[1];
          const version = parseInt(match[1], 10);
          capabilities.webp = true;
          capabilities.avif = version >= 90;
          capabilities.webm = true;
        }
      }
      // Old Edge
      else {
        const match = ua.match(/edge\/([0-9.]+)/);
        if (match) {
          capabilities.version = match[1];
          const version = parseInt(match[1], 10);
          capabilities.webp = version >= 18;
          capabilities.avif = false;
          capabilities.webm = false;
        }
      }
    }

    // Detect if it's a mobile browser
    capabilities.mobile =
      ua.includes('mobile') ||
      ua.includes('android') ||
      ua.includes('iphone') ||
      ua.includes('ipod');

    logDebug('ClientDetection', `Detected browser capabilities`, {
      browser: capabilities.name,
      version: capabilities.version,
      webp: capabilities.webp,
      avif: capabilities.avif,
      mobile: capabilities.mobile,
    });

    return capabilities;
  }

  /**
   * Get responsive width based on client hints and device type
   * @param request The request to analyze
   * @param deviceType Device type (mobile, tablet, desktop)
   * @returns The calculated responsive width
   */
  function getResponsiveWidth(request: Request, deviceType: string): number {
    // First priority: Use client hints if available
    const viewportWidth = getViewportWidth(request);
    const dpr = getDevicePixelRatio(request) || 1;

    if (viewportWidth) {
      // Scale by device pixel ratio
      const responsiveWidth = Math.round(viewportWidth * dpr);
      logDebug('ClientDetection', 'Using client hints for width', {
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
      logDebug('ClientDetection', 'Using CF-Device-Type for width', {
        cfDeviceType,
        width: deviceInfo.width,
      });
      return deviceInfo.width;
    }

    // Third priority: Use the provided device type from User-Agent detection
    const deviceWidth =
      defaultDeviceWidths[deviceType as keyof typeof defaultDeviceWidths] ||
      defaultDeviceWidths.desktop;

    logDebug('ClientDetection', 'Using User-Agent device type for width', {
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
  function snapToBreakpoint(width: number, breakpoints: number[] = defaultBreakpoints): number {
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
        const snappedWidth = width - current < next - width ? current : next;
        logDebug('ClientDetection', `Snapped width ${width} to breakpoint ${snappedWidth}`);
        return snappedWidth;
      }
    }

    // Default to the middle breakpoint if something went wrong
    const defaultWidth = breakpoints[Math.floor(breakpoints.length / 2)];
    logDebug(
      'ClientDetection',
      `Could not find appropriate breakpoint, using default: ${defaultWidth}`
    );
    return defaultWidth;
  }

  /**
   * Determines the optimal format based on browser capabilities
   * @param userAgent User agent string
   * @param accept Accept header value
   * @returns Optimal image or video format
   */
  function getOptimalFormat(userAgent: string, accept: string | null): string {
    const capabilities = detectBrowserCapabilities(userAgent);
    let format: string;

    if (!accept) {
      format = capabilities.avif ? 'avif' : capabilities.webp ? 'webp' : 'auto';
      logDebug('ClientDetection', `No Accept header, using format: ${format}`);
      return format;
    }

    // Check accept header for supported formats
    if (accept.includes('image/avif') && capabilities.avif) {
      format = 'avif';
    } else if (accept.includes('image/webp') && capabilities.webp) {
      format = 'webp';
    } else if (accept.includes('video/')) {
      format = capabilities.webm ? 'webm' : 'mp4';
    } else {
      // Let Cloudflare decide based on the Accept header
      format = 'auto';
    }

    logDebug(
      'ClientDetection',
      `Selected format ${format} based on Accept header and capabilities`
    );
    return format;
  }

  return {
    hasClientHints,
    getViewportWidth,
    getDevicePixelRatio,
    getNetworkQuality,
    hasCfDeviceType,
    getCfDeviceType,
    getDeviceInfo,
    normalizeDeviceType,
    getDeviceTypeFromUserAgent,
    detectBrowserCapabilities,
    getResponsiveWidth,
    snapToBreakpoint,
    getOptimalFormat,
  };
}

// Backward compatibility functions
// ------------------------------

/**
 * @deprecated Use createClientDetectionUtils().hasClientHints instead
 */
export function hasClientHints(request: Request): boolean {
  return createClientDetectionUtils().hasClientHints(request);
}

/**
 * @deprecated Use createClientDetectionUtils().getViewportWidth instead
 */
export function getViewportWidth(request: Request): number | null {
  return createClientDetectionUtils().getViewportWidth(request);
}

/**
 * @deprecated Use createClientDetectionUtils().getDevicePixelRatio instead
 */
export function getDevicePixelRatio(request: Request): number | null {
  return createClientDetectionUtils().getDevicePixelRatio(request);
}

/**
 * @deprecated Use createClientDetectionUtils().getNetworkQuality instead
 */
export function getNetworkQuality(request: Request): NetworkQuality {
  return createClientDetectionUtils().getNetworkQuality(request);
}

/**
 * @deprecated Use createClientDetectionUtils().hasCfDeviceType instead
 */
export function hasCfDeviceType(request: Request): boolean {
  return createClientDetectionUtils().hasCfDeviceType(request);
}

/**
 * @deprecated Use createClientDetectionUtils().getCfDeviceType instead
 */
export function getCfDeviceType(request: Request): string | null {
  return createClientDetectionUtils().getCfDeviceType(request);
}

/**
 * @deprecated Use createClientDetectionUtils().getDeviceInfo instead
 */
export function getDeviceInfo(deviceType: string): DeviceInfo {
  return createClientDetectionUtils().getDeviceInfo(deviceType);
}

/**
 * @deprecated Use createClientDetectionUtils().normalizeDeviceType instead
 */
export function normalizeDeviceType(deviceType: string | null): string {
  return createClientDetectionUtils().normalizeDeviceType(deviceType);
}

/**
 * @deprecated Use createClientDetectionUtils().getDeviceTypeFromUserAgent instead
 */
export function getDeviceTypeFromUserAgent(userAgent: string): string {
  return createClientDetectionUtils().getDeviceTypeFromUserAgent(userAgent);
}

/**
 * @deprecated Use createClientDetectionUtils().detectBrowserCapabilities instead
 */
export function detectBrowserCapabilities(userAgent: string): BrowserCapabilities {
  return createClientDetectionUtils().detectBrowserCapabilities(userAgent);
}

/**
 * @deprecated Use createClientDetectionUtils().getResponsiveWidth instead
 */
export function getResponsiveWidth(request: Request, deviceType: string): number {
  return createClientDetectionUtils().getResponsiveWidth(request, deviceType);
}

/**
 * @deprecated Use createClientDetectionUtils().snapToBreakpoint instead
 */
export function snapToBreakpoint(
  width: number,
  breakpoints: number[] = defaultBreakpoints
): number {
  return createClientDetectionUtils().snapToBreakpoint(width, breakpoints);
}

/**
 * @deprecated Use createClientDetectionUtils().getOptimalFormat instead
 */
export function getOptimalFormat(userAgent: string, accept: string | null): string {
  return createClientDetectionUtils().getOptimalFormat(userAgent, accept);
}
