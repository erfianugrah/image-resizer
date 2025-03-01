/**
 * Determine cache control header based on response status
 * @param {number} status - HTTP status code
 * @param {Object} cache - Cache configuration
 * @returns {string} - Cache-Control header value
 */
export function determineCacheControl(status, cache) {
  if (!cache || !cache.ttl) return "";

  const statusGroup = Math.floor(status / 100);
  let ttl = 0;

  switch (statusGroup) {
    case 2: // 200-299 status codes
      ttl = cache.ttl.ok;
      break;
    case 3: // 300-399 status codes
      ttl = cache.ttl.redirects;
      break;
    case 4: // 400-499 status codes
      ttl = cache.ttl.clientError;
      break;
    case 5: // 500-599 status codes
      ttl = cache.ttl.serverError;
      break;
  }

  return ttl ? `public, max-age=${ttl}` : "";
}

/**
 * Generate cache tag list for the image
 * @param {string} bucketName - Origin bucket name
 * @param {string} derivative - Derivative type
 * @returns {string[]} - Array of cache tags
 */
export function generateCacheTags(bucketName, derivative) {
  const tags = ["image"];

  if (bucketName) {
    tags.push(`bucket:${bucketName}`);
  }

  if (derivative) {
    tags.push(`derivative:${derivative}`);
  }

  return tags;
}
