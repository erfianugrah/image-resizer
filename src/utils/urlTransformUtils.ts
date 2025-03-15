/**
 * Transforms a request URL based on deployment mode and configuration
 * @param request - The original request
 * @param config - Environment configuration
 * @returns The transformed request details
 */
import { imageConfig } from '../config/imageConfig';

export interface RemoteTransformResult {
  originRequest: Request;
  bucketName: string;
  originUrl: string;
  derivative: string | null;
  isRemoteFetch: boolean;
}

export interface PathTransform {
  prefix: string;
  removePrefix: boolean;
}

export interface UrlTransformConfig {
  deploymentMode: string;
  remoteBuckets?: Record<string, string>;
  derivativeTemplates?: Record<string, string>;
  pathTransforms?: Record<string, PathTransform>;
  [key: string]: unknown;
}

export interface EnvironmentVariables {
  FALLBACK_BUCKET?: string;
  [key: string]: unknown;
}

export function transformRequestUrl(
  request: Request,
  config: UrlTransformConfig,
  env?: EnvironmentVariables
): RemoteTransformResult {
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
  };

  // Handle direct deployment
  if (config.deploymentMode === 'direct') {
    result.derivative = getDerivativeForPath(segments, path, config);
    return result;
  }

  // Handle remote mode (separate worker fetching from remote buckets)
  result.isRemoteFetch = true;

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

  // Transform the URL based on bucket and path transformation rules
  const transformedPath = transformPathForRemote(path, segments, result.bucketName, config);
  const remoteOrigin = getRemoteOrigin(result.bucketName, config, env);

  // Build the new origin URL
  const originUrl = buildOriginUrl(url, transformedPath, remoteOrigin);

  result.originUrl = originUrl.toString();
  result.originRequest = createOriginRequest(result.originUrl, request);

  return result;
}

/**
 * Get derivative type based on path and configuration
 * @param segments - Path segments
 * @param path - Full path
 * @param config - Configuration
 * @returns Derivative type or object
 */
function getDerivativeForPath(
  segments: string[],
  path: string,
  config: UrlTransformConfig
): string | null {
  // Get known derivatives from imageConfig
  const knownDerivatives = Object.keys(imageConfig.derivatives);

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
  return (
    (config.remoteBuckets && config.remoteBuckets[bucketName]) ||
    (config.remoteBuckets && config.remoteBuckets.default) ||
    env?.FALLBACK_BUCKET ||
    'https://placeholder.example.com'
  );
}

/**
 * Build origin URL by combining remote origin with path and non-image params
 * @param originalUrl - Original URL object
 * @param transformedPath - Transformed path
 * @param remoteOrigin - Remote origin URL
 * @returns New origin URL
 */
function buildOriginUrl(originalUrl: URL, transformedPath: string, remoteOrigin: string): URL {
  const originUrl = new URL(transformedPath, remoteOrigin);

  // List of image-specific params to exclude
  const imageParams = [
    'width',
    'height',
    'fit',
    'quality',
    'format',
    'metadata',
    'derivative',
    // Additional Cloudflare parameters
    'dpr',
    'gravity',
    'trim',
    'brightness',
    'contrast',
    'gamma',
    'rotate',
    'sharpen',
    'saturation',
    'background',
    'blur',
    'border',
    'compression',
    'onerror',
    'anim',
  ];

  // Copy over search params, excluding image-specific ones
  originalUrl.searchParams.forEach((value, key) => {
    if (!imageParams.includes(key)) {
      originUrl.searchParams.set(key, value);
    }
  });

  return originUrl;
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
