/**
 * URL transformation utilities for image-resizer
 */

import { imageConfig } from '../config/imageConfig';
import {
  RemoteTransformResult,
  PathTransform,
  UrlTransformConfig,
  EnvironmentVariables,
  IUrlTransformUtils,
  UrlTransformUtilsDependencies,
  R2OriginConfig,
  OriginPriorityConfig,
} from '../types/utils/urlTransform';

// Re-export types for backward compatibility
export type { RemoteTransformResult, PathTransform, UrlTransformConfig, EnvironmentVariables };

/**
 * Create URL transform utilities service
 * @param dependencies - Dependencies for URL transform utilities
 * @returns URL transform utilities implementation
 */
export function createUrlTransformUtils(
  dependencies: UrlTransformUtilsDependencies
): IUrlTransformUtils {
  const { pathUtils, urlParamUtils, logger } = dependencies;

  /**
   * Transforms a request URL based on deployment mode and configuration
   * @param request - The original request
   * @param config - URL transformation configuration
   * @param env - Environment variables
   * @returns The transformed request details
   */
  function transformRequestUrl(
    request: Request,
    config: UrlTransformConfig,
    env?: EnvironmentVariables
  ): RemoteTransformResult {
    logger?.debug('UrlTransformUtils', 'Transforming request URL', {
      url: request.url,
      mode: config.mode,
    });

    const url = new URL(request.url);
    const path = url.pathname;
    const segments = path.split('/').filter((segment) => segment);

    // Default result assuming direct deployment
    const result: RemoteTransformResult = {
      originRequest: request,
      bucketName: 'default',
      originUrl: url.toString(),
      derivative: null,
      isRemoteFetch: false,
      isR2Fetch: false,
    };

    // Get origin priority configuration directly from env if possible
    logger?.debug('UrlTransformUtils', 'Raw config and env objects', {
      mode: config.mode,
      hasEnv: !!env,
      envKeys: env ? Object.keys(env) : [],
    });

    // Default if nothing else works
    const originConfig: any = {
      default_priority: config.mode === 'direct' ? ['direct'] : ['remote', 'fallback'],
    };

    // Try to get from env.ORIGIN_CONFIG first, which should be available based on our logs
    if (env && env.ORIGIN_CONFIG) {
      // Log the raw env.ORIGIN_CONFIG
      logger?.debug('UrlTransformUtils', 'Environment ORIGIN_CONFIG', {
        type: typeof env.ORIGIN_CONFIG,
        value: env.ORIGIN_CONFIG,
      });

      let configFromEnv: any = null;

      // Parse if it's a string
      if (typeof env.ORIGIN_CONFIG === 'string') {
        try {
          configFromEnv = JSON.parse(env.ORIGIN_CONFIG);
        } catch (e) {
          logger?.error('UrlTransformUtils', 'Failed to parse ORIGIN_CONFIG string', {
            error: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      }
      // Use directly if it's an object
      else if (typeof env.ORIGIN_CONFIG === 'object' && env.ORIGIN_CONFIG !== null) {
        configFromEnv = env.ORIGIN_CONFIG;
      }

      // Apply the configuration if we got something valid
      if (configFromEnv) {
        // Use the provided priority from config instead of forcing R2
        if (configFromEnv.default_priority && Array.isArray(configFromEnv.default_priority)) {
          originConfig.default_priority = configFromEnv.default_priority;
        }

        // Use R2 configuration from environment if available
        if (configFromEnv.r2) {
          originConfig.r2 = {
            enabled: configFromEnv.r2.enabled ?? true,
            binding_name: configFromEnv.r2.binding_name || 'IMAGES_BUCKET',
          };
        }

        // Add remote/fallback if present
        if (configFromEnv.remote) {
          originConfig.remote = configFromEnv.remote;
        }
        if (configFromEnv.fallback) {
          originConfig.fallback = configFromEnv.fallback;
        }

        logger?.debug('UrlTransformUtils', 'Using configuration from environment', {
          priorities: originConfig.default_priority,
          r2: originConfig.r2,
          fallback: originConfig.fallback?.url || null
        });
      }
    }

    // Find matching bucket
    if (segments.length > 0) {
      const bucketMatch = Object.keys(config.remoteBuckets || {}).find(
        (bucket) => segments[0] === bucket || path.includes(`/${bucket}/`)
      );

      if (bucketMatch) {
        result.bucketName = bucketMatch;
      }
    }

    // Determine derivative
    result.derivative = getDerivativeForPath(segments, path, config);

    // Transform the path - this will be needed for all modes
    const transformedPath = transformPathForRemote(path, segments, result.bucketName, config);

    // Get the r2 key if we need it (the key is the path without leading slash)
    // Also remove any query parameters and normalize the key
    const r2KeyRaw = transformedPath.startsWith('/')
      ? transformedPath.substring(1)
      : transformedPath;
    // Clean the key by removing any query parameters that might have been added
    const r2Key = r2KeyRaw.split('?')[0];

    logger?.debug('UrlTransformUtils', 'Prepared path for fetch', {
      originalPath: path,
      transformedPath,
      r2Key,
      mode: config.mode,
    });

    // Handle direct deployment mode if it's the first priority
    if (
      config.mode === 'direct' ||
      (originConfig.default_priority.includes('direct') &&
        originConfig.default_priority[0] === 'direct')
    ) {
      return result;
    }

    // Handle hybrid mode
    if (
      config.mode === 'hybrid' &&
      originConfig.default_priority &&
      originConfig.default_priority.length > 0
    ) {
      logger?.debug('UrlTransformUtils', 'Processing hybrid mode with priorities', {
        priorities: originConfig.default_priority,
        r2Enabled: originConfig.r2?.enabled === true,
        config: originConfig,
      });

      // Check if R2 should be used - more detailed logging
      const hasR2InPriority =
        originConfig.default_priority && originConfig.default_priority.includes('r2');
      const isR2Enabled = originConfig.r2?.enabled === true;
      const useR2 = hasR2InPriority && isR2Enabled;

      logger?.debug('UrlTransformUtils', 'R2 configuration details', {
        hasR2InPriority,
        isR2Enabled,
        useR2,
        priorityList: originConfig.default_priority,
      });

      // Set up for R2 access if configured
      if (useR2 && env) {
        const bindingName = originConfig.r2?.binding_name || 'IMAGES_BUCKET';
        const r2Bucket = env[bindingName] as R2Bucket;

        if (r2Bucket) {
          result.isR2Fetch = true;
          // Ensure the key doesn't have leading slash for R2
          result.r2Key = r2Key && typeof r2Key === 'string' ? r2Key.replace(/^\//, '') : r2Key;
          result.isRemoteFetch = false; // Not a remote fetch in this case

          logger?.debug('UrlTransformUtils', 'Using R2 bucket with priority', {
            bindingName,
            key: r2Key,
            priorities: originConfig.default_priority,
          });

          return result;
        } else {
          logger?.error('UrlTransformUtils', 'R2 bucket binding not found', {
            bindingName,
            env: Object.keys(env),
          });
        }
      }
    }

    // Default to remote mode behavior if R2 isn't available or isn't the priority
    result.isRemoteFetch = true;

    const remoteOrigin = getRemoteOrigin(result.bucketName, config, env);
    const originUrl = buildOriginUrl(url, transformedPath, remoteOrigin);

    result.originUrl = originUrl.toString();
    result.originRequest = createOriginRequest(result.originUrl, request);

    logger?.debug('UrlTransformUtils', 'Transformed request URL', {
      originalUrl: request.url,
      transformedUrl: result.originUrl,
      bucketName: result.bucketName,
      derivative: result.derivative,
      isR2Fetch: result.isR2Fetch,
      isRemoteFetch: result.isRemoteFetch,
    });

    return result;
  }

  /**
   * Get derivative type based on path and configuration
   * @param segments - Path segments
   * @param path - Full path
   * @param config - Configuration
   * @returns Derivative type or null
   */
  function getDerivativeForPath(
    segments: string[],
    path: string,
    config: UrlTransformConfig
  ): string | null {
    // Try to use the pathUtils service if available
    if (pathUtils && config.derivativeTemplates) {
      const derivative = pathUtils.getDerivativeFromPath(path, config.derivativeTemplates);
      if (derivative) {
        return derivative;
      }
    }

    // Fallback to the original implementation
    // Get known derivatives from imageConfig - checking if it's defined first
    const knownDerivatives =
      imageConfig.derivatives && typeof imageConfig.derivatives === 'object'
        ? Object.keys(imageConfig.derivatives)
        : [];

    // Check first segment if it's a known derivative
    if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
      return segments[0];
    }

    // Check derivative templates from config
    if (config.derivativeTemplates) {
      // Look for the longest matching route to handle nested paths correctly
      const matchedRoutes = Object.keys(config.derivativeTemplates)
        .filter((route) => path.includes(`/${route}/`))
        .sort((a, b) => b.length - a.length); // Sort by length, longest first

      if (matchedRoutes.length > 0) {
        return config.derivativeTemplates[matchedRoutes[0]];
      }
    }

    return null;
  }

  /**
   * Transform path for remote buckets based on configuration
   * @param path - Original path
   * @param segments - Path segments
   * @param bucketName - Bucket name
   * @param config - Configuration
   * @returns Transformed path
   */
  function transformPathForRemote(
    path: string,
    segments: string[],
    bucketName: string,
    config: UrlTransformConfig
  ): string {
    logger?.debug('UrlTransformUtils', 'Transforming path for remote', { path, bucketName });

    let transformedPath = path;

    // Get known derivatives from imageConfig
    const knownDerivatives = Object.keys(imageConfig.derivatives);

    // Remove derivative prefix if present
    if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
      transformedPath = `/${segments.slice(1).join('/')}`;
    }

    // Apply path transformations if configured
    const pathTransform = config.pathTransforms && config.pathTransforms[bucketName];

    if (pathTransform) {
      // Remove bucket prefix if configured
      if (pathTransform.removePrefix) {
        transformedPath = transformedPath.replace(`/${bucketName}`, '');
      }

      // Add prefix if configured
      if (pathTransform.prefix) {
        const pathWithoutLeadingSlash = transformedPath.startsWith('/')
          ? transformedPath.substring(1)
          : transformedPath;
        transformedPath = `/${pathTransform.prefix}${pathWithoutLeadingSlash}`;
      }
    }

    return transformedPath;
  }

  /**
   * Get remote origin URL for bucket
   * @param bucketName - Bucket name
   * @param config - Configuration
   * @param env - Environment variables
   * @returns Remote origin URL
   */
  function getRemoteOrigin(
    bucketName: string,
    config: UrlTransformConfig,
    env?: EnvironmentVariables
  ): string {
    // Get the origin from configuration or fallback
    let origin =
      (config.remoteBuckets && config.remoteBuckets[bucketName]) ||
      (config.remoteBuckets && config.remoteBuckets.default) ||
      env?.FALLBACK_BUCKET ||
      'https://placeholder.example.com';

    // Ensure the origin has a protocol prefix
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      origin = 'https://' + origin;
      logger?.debug('UrlTransformUtils', 'Added https:// prefix to origin', {
        bucketName,
        originalOrigin: origin.substring(8), // Remove the https:// we just added
        fullOrigin: origin,
      });
    }

    return origin;
  }

  /**
   * Build origin URL by combining remote origin with path and non-image params
   * @param originalUrl - Original URL object
   * @param transformedPath - Transformed path
   * @param remoteOrigin - Remote origin URL
   * @returns New origin URL
   */
  function buildOriginUrl(originalUrl: URL, transformedPath: string, remoteOrigin: string): URL {
    // Ensure remoteOrigin is a valid URL with protocol
    if (!remoteOrigin.startsWith('http://') && !remoteOrigin.startsWith('https://')) {
      remoteOrigin = 'https://' + remoteOrigin;
      logger?.debug('UrlTransformUtils', 'Added https:// prefix to remote origin', {
        remoteOrigin,
      });
    }

    try {
      const originUrl = new URL(transformedPath, remoteOrigin);

      // Get image parameter keys to exclude from origin URL
      const imageParams = Object.keys(urlParamUtils.extractDefaultImageParams());

      // Copy over search params, excluding image-specific ones
      originalUrl.searchParams.forEach((value, key) => {
        if (!imageParams.includes(key)) {
          originUrl.searchParams.set(key, value);
        }
      });

      return originUrl;
    } catch (err) {
      logger?.error('UrlTransformUtils', 'Error building origin URL', {
        transformedPath,
        remoteOrigin,
        error: err instanceof Error ? err.message : 'Unknown error',
      });

      // Fallback to a safe URL
      return new URL(transformedPath, 'https://fallback.example.com');
    }
  }

  /**
   * Create new request for the origin
   * @param originUrl - URL to request
   * @param originalRequest - Original request
   * @returns New request
   */
  function createOriginRequest(originUrl: string, originalRequest: Request): Request {
    return new Request(originUrl, {
      method: originalRequest.method,
      headers: originalRequest.headers,
      body: originalRequest.body,
      redirect: 'follow',
    });
  }

  return {
    transformRequestUrl,
  };
}

// Backward compatibility function
/**
 * @deprecated Use createUrlTransformUtils().transformRequestUrl instead
 */
export function transformRequestUrl(
  request: Request,
  config: UrlTransformConfig,
  env?: EnvironmentVariables
): RemoteTransformResult {
  // Import modules needed for backward compatibility
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { extractDefaultImageParams } = require('./urlParamUtils');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDerivativeFromPath } = require('./pathUtils');

  // Create minimal dependencies objects with just what we need for backward compatibility
  const urlParamUtils = { extractDefaultImageParams };
  const pathUtils = { getDerivativeFromPath };

  // Create logging dependency
  const logger = {
    debug: (module: string, message: string, data?: Record<string, unknown>) => {
      console.debug(`[${module}] ${message}`, data);
    },
    error: (module: string, message: string, data?: Record<string, unknown>) => {
      console.error(`[${module}] ${message}`, data);
    },
  };

  // Create the URL transform utils and call the method
  return createUrlTransformUtils({
    pathUtils,
    urlParamUtils,
    logger,
  }).transformRequestUrl(request, config, env);
}
