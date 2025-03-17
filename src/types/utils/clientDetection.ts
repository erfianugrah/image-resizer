/**
 * Client detection interfaces
 */

/**
 * Device information interface
 */
export interface DeviceInfo {
  type: string;
  width: number;
  height?: number;
  pixelRatio?: number;
}

/**
 * Browser capabilities interface
 */
export interface BrowserCapabilities {
  avif: boolean;
  webp: boolean;
  mp4: boolean;
  webm: boolean;
  name?: string;
  version?: string;
  mobile?: boolean;
}

/**
 * Network quality information
 */
export interface NetworkQuality {
  quality: string;
  bandwidth?: number;
}

/**
 * Client detection utility interface
 */
export interface IClientDetectionUtils {
  /**
   * Check if a request has client hints
   * @param request The request to check
   * @returns Whether the request has client hints
   */
  hasClientHints(request: Request): boolean;

  /**
   * Get viewport width from client hints
   * @param request The request to extract viewport width from
   * @returns Viewport width or null if not available
   */
  getViewportWidth(request: Request): number | null;

  /**
   * Get device pixel ratio from client hints
   * @param request The request to extract DPR from
   * @returns Device pixel ratio or null if not available
   */
  getDevicePixelRatio(request: Request): number | null;

  /**
   * Get network quality from client hints
   * @param request The request to check
   * @returns Network quality information
   */
  getNetworkQuality(request: Request): NetworkQuality;

  /**
   * Check if a request has the CF-Device-Type header
   * @param request The request to check
   * @returns Whether the request has CF-Device-Type
   */
  hasCfDeviceType(request: Request): boolean;

  /**
   * Get the CF-Device-Type header value
   * @param request The request to get the device type from
   * @returns The device type or null if not available
   */
  getCfDeviceType(request: Request): string | null;

  /**
   * Get device information based on device type
   * @param deviceType Device type string
   * @returns Device information
   */
  getDeviceInfo(deviceType: string): DeviceInfo;

  /**
   * Normalize a device type string
   * @param deviceType Device type string
   * @returns Normalized device type
   */
  normalizeDeviceType(deviceType: string | null): string;

  /**
   * Get device type from a user agent string
   * @param userAgent User agent string
   * @returns Device type (mobile, tablet, desktop)
   */
  getDeviceTypeFromUserAgent(userAgent: string): string;

  /**
   * Detect browser capabilities from user agent
   * @param userAgent User agent string
   * @returns Browser capabilities object
   */
  detectBrowserCapabilities(userAgent: string): BrowserCapabilities;

  /**
   * Get responsive width based on client hints and device type
   * @param request The request to analyze
   * @param deviceType Device type (mobile, tablet, desktop)
   * @returns The calculated responsive width
   */
  getResponsiveWidth(request: Request, deviceType: string): number;

  /**
   * Snap a width to the nearest breakpoint
   * @param width Width to snap
   * @param breakpoints Optional breakpoints to use
   * @returns Snapped width
   */
  snapToBreakpoint(width: number, breakpoints?: number[]): number;

  /**
   * Determines the optimal format based on browser capabilities
   * @param userAgent User agent string
   * @param accept Accept header value
   * @returns Optimal image or video format
   */
  getOptimalFormat(userAgent: string, accept: string | null): string;
}

/**
 * Dependencies for client detection utils factory
 */
export interface ClientDetectionUtilsDependencies {
  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}

/**
 * Default breakpoints for responsive images
 */
export const defaultBreakpoints = [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840];

/**
 * Default device widths
 */
export const defaultDeviceWidths = {
  mobile: 480,
  tablet: 768,
  desktop: 1440,
};
