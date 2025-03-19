/**
 * Types for working with response headers
 */

/**
 * Cache control options for the ResponseHeadersBuilder
 */
export interface CacheControlOptions {
  /** Cache max age in seconds */
  maxAge?: number;
  /** Whether the response is public or private */
  public?: boolean;
  /** Whether to include no-store directive */
  noStore?: boolean;
  /** Whether to include no-cache directive */
  noCache?: boolean;
  /** Whether to include must-revalidate directive */
  mustRevalidate?: boolean;
  /** Whether to include immutable directive */
  immutable?: boolean;
  /** Whether to include stale-while-revalidate directive */
  staleWhileRevalidate?: number;
  /** Whether to include stale-if-error directive */
  staleIfError?: number;
}

/**
 * Interface for ResponseHeadersBuilder
 */
export interface IResponseHeadersBuilder {
  /**
   * Add cache control header with the specified options
   * @param options Cache control options
   */
  withCacheControl(options: CacheControlOptions): IResponseHeadersBuilder;

  /**
   * Add cache control header with the specified value
   * @param value Cache control header value
   */
  withCacheControlValue(value: string): IResponseHeadersBuilder;

  /**
   * Add cache tags header with the specified tags
   * @param tags Cache tags to include
   */
  withCacheTags(tags: string[]): IResponseHeadersBuilder;

  /**
   * Add content type header
   * @param contentType Content type value
   */
  withContentType(contentType: string): IResponseHeadersBuilder;

  /**
   * Add source header for tracking the transformation source
   * @param source Source identifier
   */
  withSourceHeader(source: string): IResponseHeadersBuilder;

  /**
   * Add debug headers with diagnostic information
   * @param diagnostics Diagnostic information
   */
  withDebugInfo(diagnostics: Record<string, unknown>): IResponseHeadersBuilder;

  /**
   * Add a single header directly
   * @param name Header name
   * @param value Header value
   */
  withHeader(name: string, value: string): IResponseHeadersBuilder;

  /**
   * Add headers from an existing Headers object or record
   * @param headers Headers to copy
   * @param overwrite Whether to overwrite existing headers (defaults to true)
   */
  withHeaders(
    headers: Headers | Record<string, string>,
    overwrite?: boolean
  ): IResponseHeadersBuilder;

  /**
   * Keep only specified headers from an existing response
   * @param response Response to extract headers from
   * @param headerNames Header names to preserve (case-insensitive)
   */
  withPreservedHeaders(response: Response, headerNames: string[]): IResponseHeadersBuilder;

  /**
   * Remove specified headers
   * @param headerNames Header names to remove (case-insensitive)
   */
  withoutHeaders(headerNames: string[]): IResponseHeadersBuilder;

  /**
   * Merge with another builder
   * @param builder Builder to merge with
   * @param overwrite Whether to overwrite existing headers (defaults to false)
   */
  mergeWith(builder: IResponseHeadersBuilder, overwrite?: boolean): IResponseHeadersBuilder;

  /**
   * Build the final Headers object
   * @returns Headers object with all added headers
   */
  build(): Headers;

  /**
   * Get a header value
   * @param name Header name
   * @returns Header value or null if not found
   */
  get(name: string): string | null;

  /**
   * Check if a header exists
   * @param name Header name
   * @returns Whether the header exists
   */
  has(name: string): boolean;

  /**
   * Remove a header
   * @param name Header name
   */
  delete(name: string): IResponseHeadersBuilder;

  /**
   * Create a clone of this builder
   */
  clone(): IResponseHeadersBuilder;
}

/**
 * Configuration for ResponseHeadersBuilder
 */
export interface ResponseHeadersBuilderConfig {
  /**
   * Logger dependency
   */
  logger?: {
    debug?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
