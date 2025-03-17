/**
 * @deprecated Use clientDetectionUtils.ts instead
 * This file is kept for backward compatibility and re-exports from clientDetectionUtils
 */

export {
  getDeviceTypeFromUserAgent,
  detectBrowserCapabilities,
  getOptimalFormat,
} from './clientDetectionUtils';

export type { BrowserCapabilities } from './clientDetectionUtils';
