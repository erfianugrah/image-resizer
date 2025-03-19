/**
 * Headers Builder Utility
 *
 * Provides a fluent interface for building response headers.
 * Optimizes header creation by avoiding multiple Headers object constructions
 * and providing intelligent merging functionality.
 */

import {
  IResponseHeadersBuilder,
  CacheControlOptions,
  ResponseHeadersBuilderConfig,
} from '../types/utils/headers';

/**
 * Create a ResponseHeadersBuilder
 * @param config Optional configuration for the builder
 * @returns A new ResponseHeadersBuilder instance
 */
export function createResponseHeadersBuilder(
  config?: ResponseHeadersBuilderConfig
): IResponseHeadersBuilder {
  // Create a map to store headers
  const headerMap = new Map<string, string>();
  const logger = config?.logger;

  const logDebug = (message: string, data?: Record<string, unknown>) => {
    if (logger?.debug) {
      logger.debug('HeadersBuilder', message, data);
    }
  };

  /**
   * Convert cache control options to a string
   */
  const buildCacheControlValue = (options: CacheControlOptions): string => {
    const directives: string[] = [];

    // Public/private directive
    if (options.public !== undefined) {
      directives.push(options.public ? 'public' : 'private');
    }

    // Max age directive
    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }

    // No-store directive
    if (options.noStore) {
      directives.push('no-store');
    }

    // No-cache directive
    if (options.noCache) {
      directives.push('no-cache');
    }

    // Must-revalidate directive
    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    // Immutable directive
    if (options.immutable) {
      directives.push('immutable');
    }

    // Stale-while-revalidate directive
    if (options.staleWhileRevalidate !== undefined) {
      directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
    }

    // Stale-if-error directive
    if (options.staleIfError !== undefined) {
      directives.push(`stale-if-error=${options.staleIfError}`);
    }

    return directives.join(', ');
  };

  /**
   * Convert an object with headers to entries
   */
  const objectToEntries = (obj: Record<string, string>): [string, string][] => {
    return Object.entries(obj);
  };

  /**
   * Convert a Headers object to entries
   */
  const headersToEntries = (headers: Headers): [string, string][] => {
    const entries: [string, string][] = [];
    headers.forEach((value, key) => {
      entries.push([key, value]);
    });
    return entries;
  };

  /**
   * Process headers for either a Headers object or a Record
   */
  const processHeadersInput = (headers: Headers | Record<string, string>): [string, string][] => {
    if (headers instanceof Headers) {
      return headersToEntries(headers);
    } else {
      return objectToEntries(headers);
    }
  };

  /**
   * Convert a diagnostic info object to debug headers
   */
  const diagnosticsToHeaders = (diagnostics: Record<string, unknown>): [string, string][] => {
    const headers: [string, string][] = [];

    // Convert diagnostics to headers with X-Debug- prefix
    for (const [key, value] of Object.entries(diagnostics)) {
      if (value !== undefined) {
        // Format the header name
        const headerName = `X-Debug-${key
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, '')}`;

        // Format the value based on type
        let headerValue: string;
        if (Array.isArray(value)) {
          headerValue = value.join(',');
        } else if (typeof value === 'object' && value !== null) {
          try {
            headerValue = JSON.stringify(value);
          } catch (e) {
            headerValue = String(value);
          }
        } else {
          headerValue = String(value);
        }

        headers.push([headerName, headerValue]);
      }
    }

    return headers;
  };

  return {
    withCacheControl(options: CacheControlOptions): IResponseHeadersBuilder {
      const value = buildCacheControlValue(options);
      if (value) {
        headerMap.set('cache-control', value);
      }
      return this;
    },

    withCacheControlValue(value: string): IResponseHeadersBuilder {
      if (value) {
        headerMap.set('cache-control', value);
      }
      return this;
    },

    withCacheTags(tags: string[]): IResponseHeadersBuilder {
      if (tags && tags.length > 0) {
        headerMap.set('cache-tag', tags.join(','));
      }
      return this;
    },

    withContentType(contentType: string): IResponseHeadersBuilder {
      if (contentType) {
        headerMap.set('content-type', contentType);
      }
      return this;
    },

    withSourceHeader(source: string): IResponseHeadersBuilder {
      if (source) {
        headerMap.set('x-source', source);
      }
      return this;
    },

    withDebugInfo(diagnostics: Record<string, unknown>): IResponseHeadersBuilder {
      // Only add debug headers for fields that exist
      const debugHeaders = diagnosticsToHeaders(diagnostics);

      for (const [name, value] of debugHeaders) {
        headerMap.set(name.toLowerCase(), value);
      }

      return this;
    },

    withHeader(name: string, value: string): IResponseHeadersBuilder {
      if (name && value) {
        headerMap.set(name.toLowerCase(), value);
      }
      return this;
    },

    withHeaders(
      headers: Headers | Record<string, string>,
      overwrite = true
    ): IResponseHeadersBuilder {
      const entries = processHeadersInput(headers);

      logDebug('Adding multiple headers', { count: entries.length, overwrite });

      for (const [name, value] of entries) {
        const lowercaseName = name.toLowerCase();

        // Only set the header if it doesn't exist or we're overwriting
        if (overwrite || !headerMap.has(lowercaseName)) {
          headerMap.set(lowercaseName, value);
        }
      }

      return this;
    },

    withPreservedHeaders(response: Response, headerNames: string[]): IResponseHeadersBuilder {
      // Convert header names to lowercase for case-insensitive comparison
      const lowerCaseNames = headerNames.map((name) => name.toLowerCase());

      // Get original headers
      const originalHeaders = response.headers;

      // Add only the headers we want to preserve
      for (const name of lowerCaseNames) {
        const value = originalHeaders.get(name);
        if (value) {
          headerMap.set(name, value);
        }
      }

      return this;
    },

    withoutHeaders(headerNames: string[]): IResponseHeadersBuilder {
      // Convert header names to lowercase for case-insensitive comparison
      const lowerCaseNames = headerNames.map((name) => name.toLowerCase());

      logDebug('Removing headers', { headers: lowerCaseNames });

      // Remove the specified headers
      for (const name of lowerCaseNames) {
        headerMap.delete(name);
      }

      return this;
    },

    mergeWith(builder: IResponseHeadersBuilder, overwrite = false): IResponseHeadersBuilder {
      // Build the headers from the other builder
      const otherHeaders = builder.build();

      // Merge them into this builder
      return this.withHeaders(otherHeaders, overwrite);
    },

    build(): Headers {
      logDebug('Building headers', { count: headerMap.size });

      // Create a new Headers object with the stored headers
      const headers = new Headers();

      for (const [name, value] of headerMap.entries()) {
        headers.set(name, value);
      }

      return headers;
    },

    get(name: string): string | null {
      return headerMap.get(name.toLowerCase()) || null;
    },

    has(name: string): boolean {
      return headerMap.has(name.toLowerCase());
    },

    delete(name: string): IResponseHeadersBuilder {
      headerMap.delete(name.toLowerCase());
      return this;
    },

    clone(): IResponseHeadersBuilder {
      logDebug('Cloning headers builder', { count: headerMap.size });

      // Create a new builder
      const newBuilder = createResponseHeadersBuilder(config);

      // Copy all headers
      for (const [name, value] of headerMap.entries()) {
        newBuilder.withHeader(name, value);
      }

      return newBuilder;
    },
  };
}
