/**
 * Streaming transformation service types
 */
import { ImageTransformOptions } from './image';
import { CacheConfig } from '../utils/cache';

/**
 * Interface for image transformation strategy
 */
export interface IImageTransformationStrategy {
  /**
   * Get the name of the strategy
   */
  name: string;

  /**
   * Get the priority of the strategy (lower values = higher priority)
   */
  priority: number;

  /**
   * Check if this strategy can handle the given parameters
   * @param params Parameters to check
   */
  canHandle(params: TransformationStrategyParams): boolean;

  /**
   * Execute the transformation strategy
   * @param params Parameters for the transformation
   */
  execute(params: TransformationStrategyParams): Promise<Response>;
}

/**
 * Parameters for transformation strategies
 */
export interface TransformationStrategyParams {
  // The R2 object key or path
  key: string;

  // The R2 bucket if available
  bucket?: R2Bucket;

  // The R2 object if already loaded
  object?: R2Object;

  // Image transformation options
  options: ImageTransformOptions;

  // Original request
  request: Request;

  // Cache configuration
  cacheConfig: CacheConfig;

  // Optional fallback URL
  fallbackUrl?: string;
}

/**
 * Interface for the streaming transformation service
 */
export interface IStreamingTransformationService {
  /**
   * Process an image from R2 with streaming
   * @param r2Key - The key of the object in R2
   * @param r2Bucket - The R2 bucket
   * @param imageOptions - Image transformation options
   * @param request - Original request
   * @param cacheConfig - Cache configuration
   * @param fallbackUrl - Optional fallback URL if transformation fails
   */
  processR2Image(
    r2Key: string,
    r2Bucket: R2Bucket,
    imageOptions: ImageTransformOptions,
    request: Request,
    cacheConfig: CacheConfig,
    fallbackUrl?: string
  ): Promise<Response>;

  /**
   * Register a transformation strategy
   * @param strategy - The strategy to register
   */
  registerStrategy(strategy: IImageTransformationStrategy): void;

  /**
   * Get all registered strategies
   */
  getStrategies(): IImageTransformationStrategy[];
}

/**
 * Dependencies for the streaming transformation service
 */
export interface StreamingTransformationDependencies {
  logger: {
    debug:
      | ((module: string, message: string, data?: Record<string, unknown>) => void)
      | ((message: string, data?: Record<string, unknown>) => void);
    error:
      | ((module: string, message: string, data?: Record<string, unknown>) => void)
      | ((message: string, data?: Record<string, unknown>) => void);
    info?:
      | ((module: string, message: string, data?: Record<string, unknown>) => void)
      | ((message: string, data?: Record<string, unknown>) => void);
  };
  cache: {
    determineCacheControl: (status: number, cache?: CacheConfig) => string;
  };
  formatUtils?: {
    getBestSupportedFormat: (request: Request, format?: string) => string;
  };
  errorFactory?: {
    createError: (code: string, message: string) => { code: string; message: string; type: string };
    createNotFoundError: (message: string) => { code: string; message: string; type: string };
    createErrorResponse: (error: { code: string; message: string }) => Response;
  };
  transformationCache?: {
    getTransformationOptions: (
      options: ImageTransformOptions,
      format: string
    ) => string[] | Record<string, string | number | boolean> | URL;
    createCacheHeaders: (
      status: number,
      cacheConfig: CacheConfig,
      source?: string,
      derivative?: string | null
    ) => Headers;
  };
  // Environment service for domain-specific behavior
  environmentService?: {
    isWorkersDevDomain: (domain: string) => boolean;
    isCustomDomain: (domain: string) => boolean;
    getDomain: (url: string | URL) => string;
    getEnvironmentForDomain: (domain: string) => string;
    getRouteConfigForUrl: (url: string | URL) => {
      pattern: string;
      environment?: string;
      strategies?: {
        priorityOrder?: string[];
        enabled?: string[];
        disabled?: string[];
      };
    };
    getStrategyPriorityOrderForUrl: (url: string | URL) => string[];
    isStrategyEnabledForUrl: (strategyName: string, url: string | URL) => boolean;
  };
  // Custom strategies to use
  strategies?: IImageTransformationStrategy[];
}
