/**
 * Tests for the ResponseHeadersBuilder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResponseHeadersBuilder } from '../../src/utils/headersBuilder';
import { IResponseHeadersBuilder } from '../../src/types/utils/headers';

describe('ResponseHeadersBuilder', () => {
  let builder: IResponseHeadersBuilder;
  const mockLogger = {
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    builder = createResponseHeadersBuilder({
      logger: mockLogger,
    });
  });

  it('should create a headers builder', () => {
    expect(builder).toBeDefined();
    expect(typeof builder.build).toBe('function');
    expect(typeof builder.withHeader).toBe('function');
  });

  it('should add single headers', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/webp');
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('should add cache control with options', () => {
    builder.withCacheControl({
      public: true,
      maxAge: 3600,
      staleWhileRevalidate: 60,
    });

    const headers = builder.build();
    expect(headers.get('cache-control')).toBe('public, max-age=3600, stale-while-revalidate=60');
  });

  it('should add cache tags', () => {
    builder.withCacheTags(['image', 'webp', 'user-123']);

    const headers = builder.build();
    expect(headers.get('cache-tag')).toBe('image,webp,user-123');
  });

  it('should add a content type header', () => {
    builder.withContentType('image/webp');

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/webp');
  });

  it('should add a source header', () => {
    builder.withSourceHeader('r2-cdn-cgi');

    const headers = builder.build();
    expect(headers.get('x-source')).toBe('r2-cdn-cgi');
  });

  it('should add debug headers from diagnostic info', () => {
    const diagnostics = {
      processingTimeMs: 123,
      transformParams: { width: 800, height: 600 },
      deviceType: 'mobile',
      cachingMethod: 'cache-api',
    };

    builder.withDebugInfo(diagnostics);

    const headers = builder.build();
    expect(headers.get('x-debug-processing-time-ms')).toBe('123');
    expect(headers.get('x-debug-device-type')).toBe('mobile');
    expect(headers.get('x-debug-caching-method')).toBe('cache-api');
    expect(headers.get('x-debug-transform-params')).toBe('{"width":800,"height":600}');
  });

  it('should add headers from a Headers object', () => {
    const sourceHeaders = new Headers({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'X-Custom': 'test',
    });

    builder.withHeaders(sourceHeaders);

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/jpeg');
    expect(headers.get('cache-control')).toBe('public, max-age=86400');
    expect(headers.get('x-custom')).toBe('test');
  });

  it('should add headers from a Record object', () => {
    const sourceHeaders = {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'X-Custom': 'test-record',
    };

    builder.withHeaders(sourceHeaders);

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
    expect(headers.get('x-custom')).toBe('test-record');
  });

  it('should preserve headers from a response', () => {
    const response = new Response('test', {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': '1000',
        'Content-Encoding': 'gzip',
        'Cache-Control': 'public, max-age=3600',
        'X-Custom': 'test',
      },
    });

    builder.withPreservedHeaders(response, ['Content-Type', 'Content-Length']);

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/webp');
    expect(headers.get('content-length')).toBe('1000');
    expect(headers.get('content-encoding')).toBeNull();
    expect(headers.get('cache-control')).toBeNull();
    expect(headers.get('x-custom')).toBeNull();
  });

  it('should remove headers', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');
    builder.withHeader('X-Custom', 'test');

    builder.withoutHeaders(['Content-Type', 'X-Custom']);

    const headers = builder.build();
    expect(headers.get('content-type')).toBeNull();
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
    expect(headers.get('x-custom')).toBeNull();
  });

  it('should merge with another builder', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');

    const otherBuilder = createResponseHeadersBuilder();
    otherBuilder.withHeader('X-Custom', 'test');
    otherBuilder.withHeader('Content-Type', 'image/png'); // Should not override

    builder.mergeWith(otherBuilder, false);

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/webp'); // Not overridden
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
    expect(headers.get('x-custom')).toBe('test');
  });

  it('should merge with override', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');

    const otherBuilder = createResponseHeadersBuilder();
    otherBuilder.withHeader('X-Custom', 'test');
    otherBuilder.withHeader('Content-Type', 'image/png'); // Should override

    builder.mergeWith(otherBuilder, true);

    const headers = builder.build();
    expect(headers.get('content-type')).toBe('image/png'); // Overridden
    expect(headers.get('cache-control')).toBe('public, max-age=3600');
    expect(headers.get('x-custom')).toBe('test');
  });

  it('should clone the builder', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');

    const clonedBuilder = builder.clone();
    clonedBuilder.withHeader('X-Custom', 'test');
    clonedBuilder.withHeader('Content-Type', 'image/png'); // Should override

    // Original builder should remain unchanged
    const originalHeaders = builder.build();
    expect(originalHeaders.get('content-type')).toBe('image/webp');
    expect(originalHeaders.get('cache-control')).toBe('public, max-age=3600');
    expect(originalHeaders.get('x-custom')).toBeNull();

    // Cloned builder should have all headers
    const clonedHeaders = clonedBuilder.build();
    expect(clonedHeaders.get('content-type')).toBe('image/png');
    expect(clonedHeaders.get('cache-control')).toBe('public, max-age=3600');
    expect(clonedHeaders.get('x-custom')).toBe('test');
  });

  it('should handle get, has, and delete operations', () => {
    builder.withHeader('Content-Type', 'image/webp');
    builder.withHeader('Cache-Control', 'public, max-age=3600');

    // Test get
    expect(builder.get('content-type')).toBe('image/webp');
    expect(builder.get('Content-Type')).toBe('image/webp'); // Case-insensitive
    expect(builder.get('x-custom')).toBeNull();

    // Test has
    expect(builder.has('content-type')).toBe(true);
    expect(builder.has('Content-Type')).toBe(true); // Case-insensitive
    expect(builder.has('x-custom')).toBe(false);

    // Test delete
    builder.delete('content-type');
    expect(builder.has('content-type')).toBe(false);
    expect(builder.get('content-type')).toBeNull();
  });

  it('should handle empty or null values', () => {
    // Empty cache tags
    builder.withCacheTags([]);
    expect(builder.has('cache-tag')).toBe(false);

    // Empty headers
    builder.withHeader('', 'test');
    builder.withHeader('test', '');
    const headers = builder.build();
    expect(headers.get('test')).toBeNull();
  });
});
