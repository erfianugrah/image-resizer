/**
 * Mock service implementations for testing
 * Provides mock implementations of services for use in tests
 */
import { ICacheManagementService } from '../../types/utils/cache';
import { IDebugService } from '../../types/utils/debug';
import { IImageOptionsService, IImageTransformationService } from '../../types/services/image';
import { IImageProcessingService } from '../../types/services/imageProcessing';
import { ILogger } from '../../types/core/logger';

// Define a minimal mock implementation
type MockFn<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  mockReturnValue: (value: ReturnType<T>) => MockFn<T>;
  mockResolvedValue: (value: Awaited<ReturnType<T>>) => MockFn<T>;
  mockImplementation: (fn: T) => MockFn<T>;
};

function createMockFn<T extends (...args: any[]) => any>(): MockFn<T> {
  const mockFn = ((...args: any[]) => {
    const implementation = (mockFn as any).currentImplementation;
    if (implementation) {
      return implementation(...args);
    }
    return (mockFn as any).returnValue;
  }) as MockFn<T>;

  (mockFn as any).returnValue = undefined;
  (mockFn as any).currentImplementation = null;

  mockFn.mockReturnValue = (value) => {
    (mockFn as any).returnValue = value;
    return mockFn;
  };

  mockFn.mockResolvedValue = (value) => {
    (mockFn as any).returnValue = Promise.resolve(value);
    return mockFn;
  };

  mockFn.mockImplementation = (fn) => {
    (mockFn as any).currentImplementation = fn;
    return mockFn;
  };

  return mockFn;
}

/**
 * Create a mock logger for testing
 * @returns Mock logger implementation
 */
export function createMockLogger(): ILogger {
  return {
    debug: createMockFn(),
    info: createMockFn(),
    warn: createMockFn(),
    error: createMockFn(),
    logRequest: createMockFn(),
    logResponse: createMockFn(),
  };
}

/**
 * Create a mock cache management service for testing
 * @returns Mock cache management service implementation
 */
export function createMockCacheService(): ICacheManagementService {
  return {
    getCachedResponse:
      createMockFn<ICacheManagementService['getCachedResponse']>().mockResolvedValue(null),
    cacheResponse: createMockFn<ICacheManagementService['cacheResponse']>().mockResolvedValue(true),
    applyCacheHeaders: createMockFn<
      ICacheManagementService['applyCacheHeaders']
    >().mockImplementation((response) => response),
    generateCacheTags: createMockFn<ICacheManagementService['generateCacheTags']>().mockReturnValue(
      ['mock-tag-1', 'mock-tag-2']
    ),
  };
}

/**
 * Create a mock debug service for testing
 * @returns Mock debug service implementation
 */
export function createMockDebugService(): IDebugService {
  return {
    extractRequestHeaders: createMockFn<IDebugService['extractRequestHeaders']>().mockReturnValue(
      {}
    ),
    addDebugHeaders: createMockFn<IDebugService['addDebugHeaders']>().mockImplementation(
      (response) => response
    ),
    createDebugReport:
      createMockFn<IDebugService['createDebugReport']>().mockReturnValue('<debug-report>'),
  };
}

/**
 * Create a mock image options service for testing
 * @returns Mock image options service implementation
 */
export function createMockImageOptionsService(): IImageOptionsService {
  return {
    determineImageOptions: createMockFn<
      IImageOptionsService['determineImageOptions']
    >().mockResolvedValue({
      width: 800,
      height: 600,
      quality: 80,
      format: 'auto',
      fit: 'cover',
    }),
    handleAutoWidth: createMockFn<IImageOptionsService['handleAutoWidth']>().mockImplementation(
      (request, options) => ({ ...options, width: 800 })
    ),
  };
}

/**
 * Create a mock image transformation service for testing
 * @returns Mock image transformation service implementation
 */
export function createMockImageTransformationService(): IImageTransformationService {
  return {
    transformImage: createMockFn<IImageTransformationService['transformImage']>().mockResolvedValue(
      new Response('Mock image data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    ),
    getBestImageFormat:
      createMockFn<IImageTransformationService['getBestImageFormat']>().mockReturnValue('webp'),
  };
}

/**
 * Create a mock image processing service for testing
 * @returns Mock image processing service implementation
 */
export function createMockImageProcessingService(): IImageProcessingService {
  return {
    processImage: createMockFn<IImageProcessingService['processImage']>().mockResolvedValue(
      new Response('Mock processed image', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    ),
    fetchWithImageOptions: createMockFn<
      IImageProcessingService['fetchWithImageOptions']
    >().mockResolvedValue(
      new Response('Mock fetched image', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      })
    ),
    buildResponse: createMockFn<IImageProcessingService['buildResponse']>().mockImplementation(
      (request, response) => response
    ),
  };
}
