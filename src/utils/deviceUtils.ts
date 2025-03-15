/**
 * Device detection utility functions
 */

import { debug as _debug } from './loggerUtils';

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
 * Check if a request has the CF-Device-Type header
 * @param request The request to check
 * @returns Whether the request has CF-Device-Type
 */
export function hasCfDeviceType(request: Request): boolean {
  return !!request.headers.get('CF-Device-Type');
}

/**
 * Get the CF-Device-Type header value
 * @param request The request to get the device type from
 * @returns The device type or null if not available
 */
export function getCfDeviceType(request: Request): string | null {
  return request.headers.get('CF-Device-Type');
}

/**
 * Get device information based on device type
 * @param deviceType Device type string
 * @returns Device information
 */
export function getDeviceInfo(deviceType: string): DeviceInfo {
  switch (deviceType.toLowerCase()) {
    case 'mobile':
      return {
        type: 'mobile',
        width: 480,
        height: 854,
        pixelRatio: 2,
      };
    case 'tablet':
      return {
        type: 'tablet',
        width: 768,
        height: 1024,
        pixelRatio: 1.5,
      };
    case 'desktop':
    default:
      return {
        type: 'desktop',
        width: 1440,
        pixelRatio: 1,
      };
  }
}

/**
 * Normalize a device type string
 * @param deviceType Device type string
 * @returns Normalized device type
 */
export function normalizeDeviceType(deviceType: string | null): string {
  if (!deviceType) {
    return 'desktop';
  }

  deviceType = deviceType.toLowerCase();

  if (deviceType.includes('mobile') || deviceType === 'phone') {
    return 'mobile';
  } else if (deviceType.includes('tablet')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}
