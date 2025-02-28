import { imageConfig } from "../config/imageConfig";

/**
 * Determine cache configuration based on URL
 * @param {string} url - The full URL to check
 * @returns {Object} - Cache configuration
 */
export function determineCacheConfig(url) {
  // Find matching cache configuration from config
  const cacheAsset = Object.values(imageConfig.cache).find((asset) => {
    if (!asset.regex) return false;
    return asset.regex.test(url);
  });

  if (!cacheAsset) {
    // Return default empty cache config if no match
    return {
      cacheability: false,
      imageCompression: "off",
      mirage: false,
      ttl: {
        ok: 0,
        redirects: 0,
        clientError: 0,
        serverError: 0,
      },
    };
  }

  return {
    cacheability: cacheAsset.cacheability || false,
    imageCompression: cacheAsset.imageCompression || "off",
    mirage: cacheAsset.mirage || false,
    ok: cacheAsset.ttl.ok,
    redirects: cacheAsset.ttl.redirects,
    clientError: cacheAsset.ttl.clientError,
    serverError: cacheAsset.ttl.serverError,
    ttl: cacheAsset.ttl,
  };
}
