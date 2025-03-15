/**
 * Service for determining image transformation options
 */
import { debug, error } from '../utils/loggerUtils';
import { hasClientHints } from '../utils/clientHints';
import { hasCfDeviceType } from '../utils/deviceUtils';
import { getDeviceTypeFromUserAgent } from '../utils/userAgentUtils';
import { getResponsiveWidth } from '../utils/responsiveWidthUtils';
import { getBestImageFormat } from '../services/imageTransformationService';
import { ImageTransformOptions } from '../domain/commands/TransformImageCommand';

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
    const options: ImageTransformOptions = {};
    
    // Import configuration dynamically to avoid circular dependencies
    const { imageConfig } = await import('../config/imageConfig');
    
    // Check if derivative is specified
    const derivative = urlParams.get('derivative');
    
    if (derivative && imageConfig.derivatives[derivative]) {
      // Apply derivative template settings
      const template = imageConfig.derivatives[derivative];
      
      // Copy template properties to options
      Object.assign(options, template);
      
      // Set source for debugging
      options.source = `derivative-${derivative}`;
      options.derivative = derivative;
      
      debug('ImageOptionsService', 'Applied derivative template', {
        derivative,
        template,
      });
    }
    
    // Check for explicit parameters (override template)
    // Handle basic parameters first
    const explicitParams = [
      'width', 'height', 'fit', 'quality', 'format',
      'dpr', 'metadata', 'gravity', 'sharpen', 'brightness', 'contrast'
    ];
    
    // Track if we have explicit parameters
    let hasExplicitParams = false;
    
    // Apply explicit parameters from URL
    for (const param of explicitParams) {
      if (urlParams.has(param)) {
        const value = urlParams.get(param);
        
        if (value !== null) {
          // Convert numeric parameters
          if (['width', 'height', 'quality', 'dpr', 'sharpen', 'brightness', 'contrast'].includes(param)) {
            if (param === 'width' && value === 'auto') {
              options[param as keyof ImageTransformOptions] = 'auto';
            } else {
              options[param as keyof ImageTransformOptions] = Number(value);
            }
          } else {
            options[param as keyof ImageTransformOptions] = value;
          }
          
          hasExplicitParams = true;
        }
      }
    }
    
    // Apply responsive sizing if width is auto or not specified
    const width = options.width;
    const clientHintsAvailable = hasClientHints(request);
    
    // Determine if we should use responsive sizing
    if ((width === 'auto' || width === undefined) && (clientHintsAvailable || hasCfDeviceType(request))) {
      // Get device type for fallback
      let deviceType = 'desktop';
      
      if (hasCfDeviceType(request)) {
        deviceType = request.headers.get('CF-Device-Type') || 'desktop';
      } else {
        deviceType = getDeviceTypeFromUserAgent(request.headers.get('User-Agent') || '');
      }
      
      // Get responsive width based on client hints and device
      const responsiveWidth = getResponsiveWidth(request, deviceType);
      
      // Apply responsive width
      options.width = responsiveWidth;
      
      // Set source for debugging
      if (!options.source) {
        options.source = width === 'auto' ? 'explicit-params-fallback' : 'responsive-fallback';
      }
      
      debug('ImageOptionsService', 'Applied responsive sizing', {
        width: responsiveWidth,
        deviceType,
        clientHints: clientHintsAvailable,
      });
    } else if (hasExplicitParams) {
      // Set source for explicit parameters
      options.source = 'explicit-width';
    }
    
    // If format is auto or not specified, determine the best format
    if (!options.format || options.format === 'auto') {
      options.format = getBestImageFormat(request);
      
      debug('ImageOptionsService', 'Selected best format', {
        format: options.format,
      });
    }
    
    return options;
  } catch (err) {
    error('ImageOptionsService', 'Error determining image options', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    
    // Return empty options on error
    return {};
  }
}