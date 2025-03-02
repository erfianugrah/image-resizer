/**
 * Transforms a request URL based on deployment mode and configuration
 * @param {Request} request - The original request
 * @param {Object} config - Environment configuration
 * @returns {Object} - The transformed request details
 */
export function transformRequestUrl(request, config, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const segments = path.split("/").filter((segment) => segment);

  // Default result assuming direct deployment
  const result = {
    originRequest: request,
    bucketName: "default",
    originUrl: url.toString(),
    derivative: null,
    isRemoteFetch: false,
  };

  // Handle direct deployment
  if (config.deploymentMode === "direct") {
    result.derivative = getDerivativeForPath(segments, path, config);
    return result;
  }

  // Handle remote mode (separate worker fetching from remote buckets)
  result.isRemoteFetch = true;

  // Find matching bucket
  if (segments.length > 0) {
    const bucketMatch = Object.keys(config.remoteBuckets || {}).find(
      (bucket) => segments[0] === bucket || path.includes(`/${bucket}/`),
    );

    if (bucketMatch) {
      result.bucketName = bucketMatch;
    }
  }

  // Determine derivative
  result.derivative = getDerivativeForPath(segments, path, config);

  // Transform the URL based on bucket and path transformation rules
  const transformedPath = transformPathForRemote(
    path,
    segments,
    result.bucketName,
    config,
  );
  const remoteOrigin = getRemoteOrigin(result.bucketName, config, env);

  // Build the new origin URL
  const originUrl = buildOriginUrl(url, transformedPath, remoteOrigin);

  result.originUrl = originUrl.toString();
  result.originRequest = createOriginRequest(result.originUrl, request);

  return result;
}

/**
 * Get derivative type based on path and configuration
 * @param {string[]} segments - Path segments
 * @param {string} path - Full path
 * @param {Object} config - Configuration
 * @returns {string|null} - Derivative type
 */
function getDerivativeForPath(segments, path, config) {
  const knownDerivatives = ["header", "thumbnail"];

  // Check first segment if it's a known derivative
  if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
    return segments[0];
  }

  // Check route derivatives from config
  if (config.routeDerivatives) {
    const routeMatch = Object.keys(config.routeDerivatives).find(
      (route) => path.includes(`/${route}/`),
    );

    if (routeMatch) {
      return config.routeDerivatives[routeMatch];
    }
  }

  return null;
}

/**
 * Transform path for remote buckets based on configuration
 * @param {string} path - Original path
 * @param {string[]} segments - Path segments
 * @param {string} bucketName - Bucket name
 * @param {Object} config - Configuration
 * @returns {string} - Transformed path
 */
function transformPathForRemote(path, segments, bucketName, config) {
  let transformedPath = path;

  // Remove derivative prefix if present
  const knownDerivatives = ["header", "thumbnail"];
  if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
    transformedPath = `/${segments.slice(1).join("/")}`;
  }

  // Apply path transformations if configured
  const pathTransform = config.pathTransforms &&
    config.pathTransforms[bucketName];

  if (pathTransform) {
    // Remove bucket prefix if configured
    if (pathTransform.removePrefix) {
      transformedPath = transformedPath.replace(`/${bucketName}`, "");
    }

    // Add prefix if configured
    if (pathTransform.prefix) {
      const pathWithoutLeadingSlash = transformedPath.startsWith("/")
        ? transformedPath.substring(1)
        : transformedPath;
      transformedPath = `/${pathTransform.prefix}${pathWithoutLeadingSlash}`;
    }
  }

  return transformedPath;
}

/**
 * Get remote origin URL for bucket
 * @param {string} bucketName - Bucket name
 * @param {Object} config - Configuration
 * @param {Object} env - Environment variables
 * @returns {string} - Remote origin URL
 */
function getRemoteOrigin(bucketName, config, env) {
  return (config.remoteBuckets && config.remoteBuckets[bucketName]) ||
    (config.remoteBuckets && config.remoteBuckets.default) ||
    env?.FALLBACK_BUCKET ||
    "https://placeholder.example.com";
}

/**
 * Build origin URL by combining remote origin with path and non-image params
 * @param {URL} originalUrl - Original URL object
 * @param {string} transformedPath - Transformed path
 * @param {string} remoteOrigin - Remote origin URL
 * @returns {URL} - New origin URL
 */
function buildOriginUrl(originalUrl, transformedPath, remoteOrigin) {
  const originUrl = new URL(transformedPath, remoteOrigin);

  // List of image-specific params to exclude
  const imageParams = [
    "width",
    "height",
    "fit",
    "quality",
    "format",
    "metadata",
    "derivative",
    "upscale",
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
 * @param {string} originUrl - URL to request
 * @param {Request} originalRequest - Original request
 * @returns {Request} - New request
 */
function createOriginRequest(originUrl, originalRequest) {
  return new Request(originUrl, {
    method: originalRequest.method,
    headers: originalRequest.headers,
    body: originalRequest.body,
    redirect: "follow",
  });
}
