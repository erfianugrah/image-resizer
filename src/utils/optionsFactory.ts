/**
 * Factory for creating image transformation options
 * Improves control flow by using strategy pattern instead of if/else chains
 */
import { ImageTransformOptions } from '../types/services/image';
import { hasClientHints } from './clientHints';
import { hasCfDeviceType } from './deviceUtils';
import { getDeviceTypeFromUserAgent } from './userAgentUtils';
import { getResponsiveWidth } from './responsiveWidthUtils';
import { determineFormat } from './formatUtils';
import { debug } from './loggerUtils';

export interface OptionsFactoryConfig {
  derivatives: Record<string, unknown>;
  responsive: {
    quality: number;
    fit: string;
    metadata: string;
    format: string;
    availableWidths: number[];
    breakpoints: number[];
    deviceWidths: Record<string, number>;
    deviceMinWidthMap: Record<string, number>;
  };
  defaults: {
    quality: number;
    fit: string;
    format: string;
    metadata: string;
  };
}

/**
 * OptionsStrategy interface for different image option creation strategies
 */
interface OptionsStrategy {
  createOptions(
    request: Request,
    urlParams: URLSearchParams,
    config: OptionsFactoryConfig
  ): Promise<ImageTransformOptions>;
}

/**
 * DerivativeStrategy - Creates options based on a predefined derivative template
 */
class DerivativeStrategy implements OptionsStrategy {
  constructor(private derivative: string) {}

  async createOptions(
    _request: Request,
    _urlParams: URLSearchParams,
    config: OptionsFactoryConfig
  ): Promise<ImageTransformOptions> {
    const template = config.derivatives[this.derivative];

    // Create options from template
    const options: ImageTransformOptions = {
      ...(template as Record<string, unknown>),
      source: `derivative-${this.derivative}`,
      derivative: this.derivative,
    };

    debug('OptionsFactory', 'Applied derivative template', {
      derivative: this.derivative,
      template: template as Record<string, unknown>,
    });

    return options;
  }
}

/**
 * ExplicitParamsStrategy - Creates options based on explicitly provided parameters
 */
class ExplicitParamsStrategy implements OptionsStrategy {
  private numericParams = [
    'width',
    'height',
    'quality',
    'dpr',
    'sharpen',
    'brightness',
    'contrast',
    'gamma',
    'saturation',
    'blur',
  ];

  private stringParams = [
    'fit',
    'format',
    'metadata',
    'gravity',
    'background',
    'border',
    'compression',
    'onerror',
    'rotate',
    'trim',
  ];

  private booleanParams = ['anim'];

  async createOptions(
    request: Request,
    urlParams: URLSearchParams,
    config: OptionsFactoryConfig
  ): Promise<ImageTransformOptions> {
    const options: ImageTransformOptions = {};

    // Apply defaults first
    options.quality = config.defaults.quality;
    options.fit = config.defaults.fit;
    options.metadata = config.defaults.metadata;

    // Process numeric parameters
    for (const param of this.numericParams) {
      const value = urlParams.get(param);

      if (value !== null) {
        if (param === 'width' && value === 'auto') {
          // Store 'auto' initially so we can adjust our response based on client hints
          options.width = 'auto';
          debug('OptionsFactory', 'Width=auto detected, will use responsive sizing', {
            param: 'width',
            value: 'auto',
          });
        } else {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            options[param] = numValue;
          }
        }
      }
    }

    // Process string parameters
    for (const param of this.stringParams) {
      const value = urlParams.get(param);
      if (value !== null) {
        options[param] = value;
      }
    }

    // Process boolean parameters
    for (const param of this.booleanParams) {
      const value = urlParams.get(param);
      if (value !== null) {
        options[param] = value === 'true' || value === '1';
      }
    }

    // Get format parameter (or use default)
    const formatParam = urlParams.get('format');

    // Set format using determineFormat function
    options.format = determineFormat(request, formatParam);

    // For debugging, mark the source
    options.source = 'explicit-params';

    return options;
  }
}

/**
 * ResponsiveStrategy - Creates options based on responsive sizing logic
 */
class ResponsiveStrategy implements OptionsStrategy {
  async createOptions(
    request: Request,
    urlParams: URLSearchParams,
    config: OptionsFactoryConfig
  ): Promise<ImageTransformOptions> {
    // Basic quality and fit settings from responsive config
    const options: ImageTransformOptions = {
      quality: config.responsive.quality,
      fit: config.responsive.fit, // Using 'contain' instead of 'cover' avoids needing both width and height
      metadata: config.responsive.metadata,
    };

    // Get device type for sizing
    let deviceType = 'desktop';

    if (hasCfDeviceType(request)) {
      deviceType = request.headers.get('CF-Device-Type') || 'desktop';
    } else {
      deviceType = getDeviceTypeFromUserAgent(request.headers.get('User-Agent') || '');
    }

    // Determine width based on responsive logic
    // Note: URL width parameter can override responsive width if needed in future
    const _widthParam = urlParams.get('width'); // Prefixed with _ to indicate intentionally unused
    const responsiveWidth = getResponsiveWidth(request, deviceType);

    // Apply responsive width
    options.width = responsiveWidth;

    // Set source for debugging - always use responsive-sizing for consistency with main branch
    options.source = 'responsive-sizing';

    // Determine format
    const formatParam = urlParams.get('format');
    options.format = determineFormat(request, formatParam);

    debug('OptionsFactory', 'Applied responsive sizing', {
      width: responsiveWidth,
      deviceType,
      clientHints: hasClientHints(request),
    });

    return options;
  }
}

/**
 * Factory function to create an ImageOptionsFactory
 * @param config Configuration for the options factory
 * @returns An ImageOptionsFactory instance
 */
export function createImageOptionsFactory(config: OptionsFactoryConfig): ImageOptionsFactory {
  return new ImageOptionsFactory(config);
}

/**
 * Strategy selector class that determines which strategy to use
 */
export class ImageOptionsFactory {
  private config: OptionsFactoryConfig;

  constructor(config: OptionsFactoryConfig) {
    this.config = config;
  }

  /**
   * Determine appropriate strategy based on request parameters
   */
  private selectStrategy(request: Request, urlParams: URLSearchParams): OptionsStrategy {
    // Check for derivative parameter first (highest priority)
    const derivative = urlParams.get('derivative');
    if (derivative && this.config.derivatives[derivative]) {
      return new DerivativeStrategy(derivative);
    }

    // Check for explicit parameters
    const hasExplicitParams = Array.from(urlParams.keys()).some(
      (key) => key !== 'derivative' && key !== 'metadata' && !['source', 'debug'].includes(key)
    );

    if (hasExplicitParams) {
      return new ExplicitParamsStrategy();
    }

    // If no explicit parameters or derivative, use responsive strategy
    // This matches the main branch behavior in determineImageOptions where it uses
    // applyResponsiveSizing when no explicit params or derivative was found
    return new ResponsiveStrategy();
  }

  /**
   * Create image options using the appropriate strategy
   */
  async createImageOptions(
    request: Request,
    urlParams: URLSearchParams
  ): Promise<ImageTransformOptions> {
    const strategy = this.selectStrategy(request, urlParams);
    const options = await strategy.createOptions(request, urlParams, this.config);

    // Apply additional processing if needed
    return this.postProcessOptions(options, request);
  }

  /**
   * Apply post-processing to options
   */
  private postProcessOptions(
    options: ImageTransformOptions,
    _request: Request
  ): ImageTransformOptions {
    // Validate options against configuration
    this.validateOptions(options);

    return options;
  }

  /**
   * Validate options against configuration constraints
   */
  private validateOptions(options: ImageTransformOptions): void {
    // Width validation
    if (options.width !== null && options.width !== undefined && options.width !== 'auto') {
      const width = Number(options.width);
      if (isNaN(width) || width < 10 || width > 8192) {
        throw new Error('Width must be between 10 and 8192 pixels or "auto"');
      }
    }

    // Height validation
    if (options.height !== null && options.height !== undefined) {
      if (options.height < 10 || options.height > 8192) {
        throw new Error('Height must be between 10 and 8192 pixels');
      }
    }

    // Quality validation
    if (options.quality !== null && options.quality !== undefined) {
      if (options.quality < 1 || options.quality > 100) {
        throw new Error('Quality must be between 1 and 100');
      }
    }
  }
}
