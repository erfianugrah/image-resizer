/**
 * Determine cache control header based on response status
 * @param {number} status - HTTP status code
 * @param {Object} cache - Cache configuration
 * @returns {string} - Cache-Control header value
 */
export function determineCacheControl(status, cache) {
  if (!cache || !cache.ttl) return "";

  const statusGroup = Math.floor(status / 100);

  // Map status groups to TTL properties
  const ttlMap = {
    2: "ok", // 200-299 status codes
    3: "redirects", // 300-399 status codes
    4: "clientError", // 400-499 status codes
    5: "serverError", // 500-599 status codes
  };

  const ttlProperty = ttlMap[statusGroup];
  const ttl = ttlProperty ? cache.ttl[ttlProperty] : 0;

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
