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
}

/**
 * Path transformation configuration
 */
export interface PathTransform {
  prefix: string;
  removePrefix: boolean;
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
  [key: string]: unknown;
}

/**
 * Environment variables for URL transformation
 */
export interface EnvironmentVariables {
  FALLBACK_BUCKET?: string;
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
