/**
 * User agent parsing and detection utility functions
 */

// Unused import removed: import { debug } from './loggerUtils';

interface BrowserCapabilities {
  avif: boolean;
  webp: boolean;
  mp4: boolean;
  webm: boolean;
  name?: string;
  version?: string;
  mobile?: boolean;
}

/**
 * Get device type from a user agent string
 * @param userAgent User agent string
 * @returns Device type (mobile, tablet, desktop)
 */
export function getDeviceTypeFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

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
      return 'tablet';
    }

    return 'mobile';
  }

  // Check for tablets
  if (
    ua.includes('ipad') ||
    ua.includes('tablet') ||
    ua.includes('playbook') ||
    ua.includes('silk')
  ) {
    return 'tablet';
  }

  // Default to desktop
  return 'desktop';
}

/**
 * Detect browser capabilities from user agent
 * @param userAgent User agent string
 * @returns Browser capabilities object
 */
export function detectBrowserCapabilities(userAgent: string): BrowserCapabilities {
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
    ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipod');

  return capabilities;
}

/**
 * Detect browsers that support video file types
 * @param userAgent User agent string
 * @returns Video capabilities
 */
export function detectBrowserVideoCapabilities(userAgent: string): BrowserCapabilities {
  return detectBrowserCapabilities(userAgent);
}
