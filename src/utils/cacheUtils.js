import { imageConfig } from "../config/imageConfig.js";

/**
 * Determine cache configuration based on URL
 * @param {string} url - The full URL to check
 * @returns {Object} - Cache configuration
 */
export function determineCacheConfig(url) {
  // Default empty cache config
  const defaultCacheConfig = {
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

  // Find matching cache configuration from config
  const cacheAsset = Object.values(imageConfig.cache).find((asset) => {
    if (!asset.regex) return false;

    // Handle both regex and string pattern types
    if (typeof asset.regex === "string") {
      return new RegExp(asset.regex).test(url);
    }
    return asset.regex.test(url);
  });

  if (!cacheAsset) {
    return defaultCacheConfig;
  }

  // Return a combined configuration
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
