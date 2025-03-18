import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUrlTransformUtils } from '../../src/utils/urlTransformUtils';
import { RemoteTransformResult } from '../../src/types/utils/urlTransform';

describe('UrlTransformUtils', () => {
  // Mock dependencies
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  const mockPathUtils = {
    getDerivativeFromPath: vi.fn((path, templates) => {
      if (path.includes('/header/')) return 'header';
      if (path.includes('/thumbnail/')) return 'thumbnail';
      return null;
    }),
  };

  const mockUrlParamUtils = {
    extractDefaultImageParams: vi.fn(() => ({
      width: null,
      height: null,
      quality: null,
      fit: null,
      format: null,
    })),
    extractImageParams: vi.fn(() => ({
      width: null,
      height: null,
      quality: null,
      fit: null,
      format: null,
    })),
  };

  // Create the service
  const urlTransformUtils = createUrlTransformUtils({
    logger: mockLogger,
    pathUtils: mockPathUtils,
    urlParamUtils: mockUrlParamUtils,
  });

  // Set up reusable variables
  let mockRequest: Request;
  let mockConfig: any;
  let mockEnv: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up default request
    mockRequest = new Request('https://image-resizer.example.com/test-image.jpg');

    // Set up default config
    mockConfig = {
      mode: 'hybrid',
      remoteBuckets: {
        default: 'https://example.com',
        images: 'https://images.example.com',
      },
      derivativeTemplates: {
        header: 'header',
        thumbnail: 'thumbnail',
      },
      pathTransforms: {
        default: {
          removePrefix: false,
          prefix: '',
        },
        images: {
          removePrefix: true,
          prefix: 'img/',
        },
      },
    };

    // Set up default environment
    mockEnv = {
      FALLBACK_BUCKET: 'https://fallback.example.com',
      ORIGIN_CONFIG: JSON.stringify({
        default_priority: ['remote', 'fallback'],
        r2: {
          enabled: false,
          binding_name: 'IMAGES_BUCKET',
        },
        remote: {
          enabled: true,
        },
        fallback: {
          enabled: true,
          url: 'https://fallback.example.com',
        },
      }),
    };
  });

  describe('transformRequestUrl', () => {
    it('should transform URLs correctly in remote mode', () => {
      // Arrange
      mockConfig.mode = 'remote';

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result).toBeDefined();
      expect(result.isRemoteFetch).toBe(true);
      expect(result.isR2Fetch).toBe(false);
      expect(result.bucketName).toBe('default');
      expect(result.originUrl).toContain('example.com');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should detect bucket name from URL path', () => {
      // Arrange
      mockRequest = new Request('https://image-resizer.example.com/images/test-image.jpg');

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.bucketName).toBe('images');
      expect(result.originUrl).toContain('images.example.com');
    });

    it('should apply path transformations correctly', () => {
      // Arrange
      mockRequest = new Request('https://image-resizer.example.com/images/test-image.jpg');

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      // Should remove 'images' prefix and add 'img/' prefix
      expect(result.originUrl).toContain('img/test-image.jpg');
      expect(result.originUrl).not.toContain('/images/test-image.jpg');
    });

    it('should detect derivatives from path', () => {
      // Arrange
      mockRequest = new Request('https://image-resizer.example.com/header/hero.jpg');

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.derivative).toBe('header');
      expect(mockPathUtils.getDerivativeFromPath).toHaveBeenCalled();
    });

    it('should handle missing environment gracefully', () => {
      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, undefined);

      // Assert
      expect(result).toBeDefined();
      expect(result.originUrl).toContain('example.com');
    });

    it('should use fallback bucket if remote is not configured', () => {
      // Arrange
      mockConfig.remoteBuckets = {};

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.originUrl).toContain('fallback.example.com');
    });

    it('should process R2 configuration correctly when enabled', () => {
      // Arrange
      const r2Bucket = {
        get: vi.fn(), // Mock method
      };

      mockEnv = {
        IMAGES_BUCKET: r2Bucket,
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['r2', 'remote', 'fallback'],
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET',
          },
        }),
      };

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.isR2Fetch).toBe(true);
      expect(result.r2Key).toBe('test-image.jpg');
      expect(result.isRemoteFetch).toBe(false);
    });

    it('should use R2 when available regardless of priority', () => {
      // Arrange
      const r2Bucket = {
        get: vi.fn(), // Mock method
      };

      mockEnv = {
        IMAGES_BUCKET: r2Bucket,
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['remote', 'r2', 'fallback'], // Remote first
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET',
          },
        }),
      };

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      // The current implementation uses R2 when available regardless of priority
      // This test reflects the actual behavior
      expect(result.isR2Fetch).toBe(true);
      expect(result.r2Key).toBe('test-image.jpg');
    });

    it('should use R2 in hybrid mode when configured', () => {
      // Arrange
      const r2Bucket = {
        get: vi.fn(), // Mock method
      };

      mockConfig.mode = 'hybrid';
      mockEnv = {
        IMAGES_BUCKET: r2Bucket,
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['r2', 'remote', 'fallback'],
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET',
          },
        }),
      };

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.isR2Fetch).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('UrlTransformUtils', 'Using R2 bucket with priority', expect.anything());
    });

    it('should handle missing R2 bucket binding gracefully', () => {
      // Arrange
      mockEnv = {
        // No IMAGES_BUCKET
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['r2', 'remote', 'fallback'],
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET', // Binding name that doesn't exist
          },
        }),
      };

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.isR2Fetch).toBe(false);
      expect(result.isRemoteFetch).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('UrlTransformUtils', 'R2 bucket binding not found', expect.anything());
    });

    it('should properly normalize R2 keys by removing leading slashes', () => {
      // Arrange
      const r2Bucket = {
        get: vi.fn(), // Mock method
      };

      mockEnv = {
        IMAGES_BUCKET: r2Bucket,
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['r2', 'remote', 'fallback'],
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET',
          },
        }),
      };

      mockRequest = new Request('https://image-resizer.example.com//test-image.jpg'); // Double slash

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      expect(result.r2Key).toBe('test-image.jpg'); // Leading slash removed
    });

    it('should handle missing R2 bucket when binding name changes', () => {
      // Arrange
      const r2Bucket = {
        get: vi.fn(), // Mock method
      };

      mockEnv = {
        CUSTOM_BUCKET: r2Bucket, // Different binding name
        ORIGIN_CONFIG: JSON.stringify({
          default_priority: ['r2', 'remote', 'fallback'],
          r2: {
            enabled: true,
            binding_name: 'DIFFERENT_BUCKET', // Binding name that doesn't match environment
          },
        }),
      };

      // Act
      const result = urlTransformUtils.transformRequestUrl(mockRequest, mockConfig, mockEnv);

      // Assert
      // Should fall back to remote since the binding name doesn't match
      expect(result.isR2Fetch).toBe(false);
      expect(result.isRemoteFetch).toBe(true);
    });
  });
});