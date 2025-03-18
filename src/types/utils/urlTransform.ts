/**
 * URL transformation interfaces and types
 */

import { PathPattern } from './path';

/**
 * Result of transforming a remote request URL
 */
export interface RemoteTransformResult {
  originRequest: Request;
  bucketName: string;
  originUrl: string;
  derivative: string | null;
  isRemoteFetch: boolean;
  isR2Fetch?: boolean;
  r2Key?: string;
}

/**
 * Path transformation configuration
 */
export interface PathTransform {
  prefix: string;
  removePrefix: boolean;
}

/**
 * R2 Origin configuration
 */
export interface R2OriginConfig {
  enabled: boolean;
  binding_name: string;
}

/**
 * Origin priority configuration
 */
export interface OriginPriorityConfig {
  default_priority: Array<'r2' | 'remote' | 'direct' | 'fallback'>;
  r2?: R2OriginConfig;
}

/**
 * Configuration for URL transformation
 */
export interface UrlTransformConfig {
  mode: string;
  remoteBuckets?: Record<string, string>;
  derivativeTemplates?: Record<string, string>;
  pathTransforms?: Record<string, PathTransform>;
  pathPatterns?: PathPattern[];
  originConfig?: OriginPriorityConfig;
  [key: string]: unknown;
}

/**
 * Environment variables for URL transformation
 */
export interface EnvironmentVariables {
  FALLBACK_BUCKET?: string;
  IMAGES_BUCKET?: R2Bucket; // R2 bucket binding
  [key: string]: unknown;
}

/**
 * Interface for URL transformation utility service
 */
export interface IUrlTransformUtils {
  /**
   * Transforms a request URL based on deployment mode and configuration
   * @param request - The original request
   * @param config - URL transformation configuration
   * @param env - Environment variables
   * @returns The transformed request details
   */
  transformRequestUrl(
    request: Request,
    config: UrlTransformConfig,
    env?: EnvironmentVariables
  ): RemoteTransformResult;
}

/**
 * Dependencies for URL transform factory
 */
export interface UrlTransformUtilsDependencies {
  /**
   * Path utilities service
   */
  pathUtils: {
    getDerivativeFromPath: (path: string, pathTemplates?: Record<string, string>) => string | null;
  };

  /**
   * URL parameter utilities
   */
  urlParamUtils: {
    extractDefaultImageParams: () => Record<string, string | null>;
  };

  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
