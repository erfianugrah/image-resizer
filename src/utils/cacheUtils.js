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

    try {
      // Handle various types of regex
      if (asset.regex instanceof RegExp) {
        // If it's already a RegExp, use it directly
        return asset.regex.test(url);
      } else if (typeof asset.regex === "string") {
        // If it's a string, create a RegExp from it
        return new RegExp(asset.regex).test(url);
      } else if (typeof asset.regex === "object") {
        // If it's an object but not a RegExp, try to convert it to a RegExp
        const regexStr = asset.regex.toString();
        const cleanRegexStr = regexStr.replace(/^\{|\}$/g, '');
        return new RegExp(cleanRegexStr).test(url);
      }
    } catch (e) {
      // Log the error and return false for this asset
      console.error(`Error testing regex for cache asset: ${e.message}`);
      return false;
    }
    
    // If we get here, we couldn't handle the regex type
    return false;
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
