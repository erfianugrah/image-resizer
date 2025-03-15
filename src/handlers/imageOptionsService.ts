/**
 * Service for determining image transformation options
 * Uses configManager and strategy pattern for cleaner control flow
 */
import { error } from '../utils/loggerUtils';
import { ConfigurationManager } from '../config/configManager';
import { extractImageParams } from '../utils/urlParamUtils';
import { ImageTransformOptions } from '../domain/commands/TransformImageCommand';
import { ImageOptionsFactory } from '../utils/optionsFactory';

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
    return await optionsFactory.createImageOptions(request, urlParams);
  } catch (err) {
    error('ImageOptionsService', 'Error determining image options', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });

    // Return empty options on error
    return {};
  }
}
