/**
 * Utilities for standardizing image transformation operations
 */
import { ImageTransformOptions } from '../types/services/image';

/**
 * Transformation options format types
 */
export enum TransformationOptionFormat {
  /** Cloudflare cf.image object format */
  CF_OBJECT = 'cf_object',
  /** CDN-CGI path parameter format */
  CDN_CGI = 'cdn_cgi',
  /** URL query parameter format */
  QUERY_PARAMS = 'query_params',
}

/**
 * Filter options for CF Image object
 * @param options Original image transformation options
 * @returns Filtered options suitable for CF image object
 */
export function prepareCfImageOptions(
  options: ImageTransformOptions
): Record<string, string | number | boolean> {
  // Create a copy of options for the cf.image object
  const imageOptions: Record<string, string | number | boolean> = {};

  // Process each option that's valid for CF image object
  if (typeof options.width === 'number') {
    imageOptions.width = options.width;
  }

  if (typeof options.height === 'number') {
    imageOptions.height = options.height;
  }

  if (typeof options.fit === 'string') {
    imageOptions.fit = options.fit;
  }

  if (typeof options.quality === 'number') {
    imageOptions.quality = options.quality;
  }

  if (typeof options.format === 'string') {
    imageOptions.format = options.format;
  }

  if (typeof options.metadata === 'string') {
    imageOptions.metadata = options.metadata;
  }

  if (typeof options.gravity === 'string') {
    imageOptions.gravity = options.gravity;
  }

  if (typeof options.sharpen === 'number') {
    imageOptions.sharpen = options.sharpen;
  }

  if (typeof options.brightness === 'number') {
    imageOptions.brightness = options.brightness;
  }

  if (typeof options.contrast === 'number') {
    imageOptions.contrast = options.contrast;
  }

  return imageOptions;
}

/**
 * Prepare options for CDN-CGI URL path parameters
 * @param options Original image transformation options
 * @returns Array of CDN-CGI parameters
 */
export function prepareCdnCgiOptions(options: ImageTransformOptions): string[] {
  const cdnCgiParams: string[] = [];

  // Add required parameters in CDN-CGI format
  if (typeof options.width === 'number') {
    cdnCgiParams.push(`width=${options.width}`);
  }

  if (options.height && typeof options.height === 'number') {
    cdnCgiParams.push(`height=${options.height}`);
  }

  if (options.fit && typeof options.fit === 'string') {
    cdnCgiParams.push(`fit=${options.fit}`);
  }

  if (options.quality && typeof options.quality === 'number') {
    cdnCgiParams.push(`quality=${options.quality}`);
  }

  if (options.format && typeof options.format === 'string') {
    cdnCgiParams.push(`format=${options.format}`);
  }

  if (options.gravity && typeof options.gravity === 'string') {
    cdnCgiParams.push(`gravity=${options.gravity}`);
  }

  if (options.metadata && typeof options.metadata === 'string') {
    cdnCgiParams.push(`metadata=${options.metadata}`);
  }

  if (options.sharpen && typeof options.sharpen === 'number') {
    cdnCgiParams.push(`sharpen=${options.sharpen}`);
  }

  if (options.brightness && typeof options.brightness === 'number') {
    cdnCgiParams.push(`brightness=${options.brightness}`);
  }

  if (options.contrast && typeof options.contrast === 'number') {
    cdnCgiParams.push(`contrast=${options.contrast}`);
  }

  return cdnCgiParams;
}

/**
 * Add image transformation options to URL query parameters
 * @param url URL to add query parameters to
 * @param options Image transformation options
 * @returns URL with added query parameters
 */
export function addOptionsToUrlParams(url: URL, options: ImageTransformOptions): URL {
  // Create a clone of the URL to avoid modifying the original
  const newUrl = new URL(url.toString());

  // Add all non-null, non-undefined options to query parameters
  Object.entries(options).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      newUrl.searchParams.set(key, String(value));
    }
  });

  return newUrl;
}

/**
 * Clean up and normalize image transformation options
 * @param options Original options that may have non-standard values
 * @returns Cleaned and validated options
 */
export function normalizeImageOptions(options: ImageTransformOptions): ImageTransformOptions {
  const result: ImageTransformOptions = { ...options };

  // Handle width=auto (which Cloudflare doesn't support directly)
  if (result.width === 'auto') {
    // Remove the width parameter entirely since it should be handled separately
    delete result.width;
  }

  // Remove non-Cloudflare options that shouldn't be passed to transformation APIs
  const nonCloudflareOptions = ['source', 'derivative'];
  nonCloudflareOptions.forEach((opt) => {
    delete result[opt as keyof typeof result];
  });

  return result;
}

/**
 * Create transformation options in the specified format
 * @param options Original image transformation options
 * @param format Desired output format for the options
 * @returns Formatted options in the requested format
 */
export function prepareTransformationOptions(
  options: ImageTransformOptions,
  format: TransformationOptionFormat
): string[] | Record<string, string | number | boolean> | URL {
  // First normalize the options to ensure consistency
  const normalizedOptions = normalizeImageOptions(options);

  // Return the options in the requested format
  switch (format) {
    case TransformationOptionFormat.CF_OBJECT:
      return prepareCfImageOptions(normalizedOptions);

    case TransformationOptionFormat.CDN_CGI:
      return prepareCdnCgiOptions(normalizedOptions);

    case TransformationOptionFormat.QUERY_PARAMS:
      return addOptionsToUrlParams(new URL('https://example.com'), normalizedOptions);

    default:
      throw new Error(`Unsupported transformation option format: ${format}`);
  }
}
