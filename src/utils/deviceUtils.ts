/**
 * @deprecated Use clientDetectionUtils.ts instead
 * This file is kept for backward compatibility and re-exports from clientDetectionUtils
 */

export {
  hasCfDeviceType,
  getCfDeviceType,
  getDeviceInfo,
  normalizeDeviceType,
  getDeviceTypeFromUserAgent,
} from './clientDetectionUtils';

export type { DeviceInfo } from './clientDetectionUtils';
