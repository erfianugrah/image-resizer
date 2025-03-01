/**
 * Transforms a request URL based on deployment mode and configuration
 * @param {Request} request - The original request
 * @param {Object} config - Environment configuration
 * @returns {Object} - The transformed request details
 */
export function transformRequestUrl(request, config) {
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

  // Handle local mode (direct deployment)
  if (config.deploymentMode === "direct") {
    // Just check if there's a route-based derivative match
    if (segments.length > 0) {
      const routeMatch = Object.keys(config.routeDerivatives).find(
        (route) => path.includes(`/${route}/`),
      );

      if (routeMatch) {
        result.derivative = config.routeDerivatives[routeMatch];
      }
    }

    return result;
  }

  // Handle remote mode (separate worker fetching from remote buckets)
  result.isRemoteFetch = true;

  // Find the matching bucket
  if (segments.length > 0) {
    const bucketMatch = Object.keys(config.remoteBuckets).find(
      (bucket) => segments[0] === bucket || path.includes(`/${bucket}/`),
    );

    if (bucketMatch) {
      result.bucketName = bucketMatch;
    }
  }

  // Get the remote origin for this bucket
  const remoteOrigin = config.remoteBuckets[result.bucketName] ||
    config.remoteBuckets.default;

  // Apply path transformations if any
  let transformedPath = path;
  const pathTransform = config.pathTransforms[result.bucketName];

  if (pathTransform) {
    if (pathTransform.removePrefix) {
      // Remove the bucket name prefix from the path
      transformedPath = transformedPath.replace(`/${result.bucketName}`, "");
    }

    if (pathTransform.prefix) {
      // Add the configured prefix
      transformedPath = `/${pathTransform.prefix}${
        transformedPath.startsWith("/")
          ? transformedPath.substring(1)
          : transformedPath
      }`;
    }
  }

  // Build the new origin URL
  const originUrl = new URL(transformedPath, remoteOrigin);
  // Copy over search params
  url.searchParams.forEach((value, key) => {
    originUrl.searchParams.set(key, value);
  });

  result.originUrl = originUrl.toString();

  // Create a new request to the origin
  result.originRequest = new Request(result.originUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: "follow",
  });

  // Check for route-based derivative
  const routeMatch = Object.keys(config.routeDerivatives).find(
    (route) => path.includes(`/${route}/`),
  );

  if (routeMatch) {
    result.derivative = config.routeDerivatives[routeMatch];
  }

  return result;
}
