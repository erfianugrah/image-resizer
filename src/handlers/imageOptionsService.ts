/**
 * Service for determining image transformation options
 * Uses configManager and strategy pattern for cleaner control flow
 */
import { debug, error } from '../utils/loggerUtils';
import { ConfigurationManager } from '../config/configManager';
import { extractImageParams } from '../utils/urlParamUtils';
import { ImageTransformOptions } from '../domain/commands/TransformImageCommand';
import { ImageOptionsFactory } from '../utils/optionsFactory';
import { snapToBreakpoint } from '../utils/responsiveWidthUtils';
import { hasClientHints, getViewportWidth, getDevicePixelRatio } from '../utils/clientHints';
import { hasCfDeviceType, getDeviceInfo } from '../utils/deviceUtils';
import { getDeviceTypeFromUserAgent } from '../utils/userAgentUtils';

/**
 * Determine image options for a request
 * @param request - The original request
 * @param urlParams - URL search parameters
 * @param pathname - URL path
 * @returns Image transformation options
 */
export async function determineImageOptions(
  request: Request,
  urlParams: URLSearchParams,
  pathname: string
): Promise<ImageTransformOptions> {
  try {
    // Extract all image parameters from URL and add them to urlParams
    extractImageParams(urlParams, pathname);

    // Get configuration from the manager
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getConfig();

    // Create the options factory with configuration
    const optionsFactory = new ImageOptionsFactory({
      derivatives: config.derivatives,
      responsive: config.responsive,
      defaults: config.defaults,
    });

    // Use the factory to create image options based on the request
    let imageOptions = await optionsFactory.createImageOptions(request, urlParams);

    // Special handling for width=auto - we need to convert it to a numerical value
    // before passing to Cloudflare Image Resizing
    if (imageOptions.width === 'auto') {
      // Handle auto width using responsive sizing to find appropriate width
      imageOptions = handleAutoWidth(request, imageOptions);
    }

    return imageOptions;
  } catch (err) {
    error('ImageOptionsService', 'Error determining image options', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Return empty options on error
    return {};
  }
}

/**
 * Handle width=auto by determining appropriate responsive width
 * @param request - Original request
 * @param options - Current image options with width=auto
 * @returns Updated options with width as a number
 */
/**
 * Handle width=auto by determining appropriate responsive width
 * Priority: Client Hints → CF-Device-Type → User Agent
 * @param request - Original request
 * @param options - Current image options with width=auto
 * @returns Updated options with width as a number
 */
function handleAutoWidth(request: Request, options: ImageTransformOptions): ImageTransformOptions {
  debug('ImageOptionsService', 'Processing width=auto parameter');

  // Get configuration for responsive settings
  const configManager = ConfigurationManager.getInstance();
  const config = configManager.getConfig();
  const responsiveConfig = config.responsive;

  // Consistent with main branch: try client hints first
  if (hasClientHints(request)) {
    // Extract viewport width and DPR from client hints
    const viewportWidth = getViewportWidth(request);
    const dpr = getDevicePixelRatio(request) || 1;

    if (viewportWidth) {
      // Apply DPR scaling
      const scaledWidth = Math.round(viewportWidth * dpr);

      // Snap to nearest breakpoint width
      const breakpoints = responsiveConfig.breakpoints || [320, 768, 960, 1440, 1920, 2048];
      const finalWidth = snapToBreakpoint(scaledWidth, breakpoints);

      debug('ImageOptionsService', 'Using client hints for width=auto', {
        viewportWidth,
        dpr,
        scaledWidth,
        finalWidth,
      });

      return {
        ...options,
        width: finalWidth,
        source: 'client-hints-responsive',
      };
    }
  }

  // Try CF-Device-Type next
  if (hasCfDeviceType(request)) {
    const deviceType = request.headers.get('CF-Device-Type') || 'desktop';
    const deviceInfo = getDeviceInfo(deviceType);

    debug('ImageOptionsService', 'Using CF-Device-Type for width=auto', {
      deviceType,
      width: deviceInfo.width,
    });

    return {
      ...options,
      width: deviceInfo.width,
      source: 'cf-device-responsive',
    };
  }

  // Finally, fall back to user agent detection
  const deviceType = getDeviceTypeFromUserAgent(request.headers.get('User-Agent') || '');
  const defaultWidths = {
    mobile: 480,
    tablet: 768,
    desktop: 1440,
  };

  // Get width based on device type
  const deviceWidth =
    responsiveConfig.deviceWidths?.[deviceType as keyof typeof responsiveConfig.deviceWidths] ||
    defaultWidths[deviceType as keyof typeof defaultWidths] ||
    1440;

  debug('ImageOptionsService', 'Using User-Agent detection for width=auto', {
    deviceType,
    width: deviceWidth,
  });

  return {
    ...options,
    width: deviceWidth,
    source: 'user-agent-responsive',
  };
}
