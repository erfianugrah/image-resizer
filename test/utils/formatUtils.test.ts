import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  determineFormat,
  getContentTypeForFormat,
  createFormatUtils,
} from '../../src/utils/formatUtils';

describe('formatUtils', () => {
  // Test the deprecated, backward-compatible functions
  describe('Legacy API', () => {
    describe('determineFormat', () => {
      it('should return the provided format if specified', () => {
        // Arrange
        const request = new Request('https://example.com/image.jpg');
        const formatParam = 'webp';

        // Act
        const result = determineFormat(request, formatParam);

        // Assert
        expect(result).toBe('webp');
      });

      it('should return avif for browsers supporting avif', () => {
        // Arrange
        const request = new Request('https://example.com/image.jpg', {
          headers: {
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        // Act
        const result = determineFormat(request, null);

        // Assert
        expect(result).toBe('avif');
      });

      it('should return webp for browsers supporting webp but not avif', () => {
        // Arrange
        const request = new Request('https://example.com/image.jpg', {
          headers: {
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        // Act
        const result = determineFormat(request, null);

        // Assert
        expect(result).toBe('webp');
      });

      it('should return avif as default for browsers with no specific support', () => {
        // Arrange
        const request = new Request('https://example.com/image.jpg', {
          headers: {
            Accept: 'image/*,*/*;q=0.8',
          },
        });

        // Act
        const result = determineFormat(request, null);

        // Assert
        expect(result).toBe('avif');
      });

      it('should handle auto format parameter by detecting from Accept header', () => {
        // Arrange
        const request = new Request('https://example.com/image.jpg', {
          headers: {
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        // Act
        const result = determineFormat(request, 'auto');

        // Assert
        expect(result).toBe('webp');
      });
    });

    describe('getContentTypeForFormat', () => {
      it('should return correct content type for known formats', () => {
        // Arrange & Act & Assert
        expect(getContentTypeForFormat('avif')).toBe('image/avif');
        expect(getContentTypeForFormat('webp')).toBe('image/webp');
        expect(getContentTypeForFormat('png')).toBe('image/png');
        expect(getContentTypeForFormat('gif')).toBe('image/gif');
        expect(getContentTypeForFormat('jpg')).toBe('image/jpeg');
        expect(getContentTypeForFormat('jpeg')).toBe('image/jpeg');
        expect(getContentTypeForFormat('svg')).toBe('image/svg+xml');
      });

      it('should return image/jpeg for unknown formats', () => {
        // Arrange & Act & Assert
        expect(getContentTypeForFormat('unknown')).toBe('image/jpeg');
      });

      it('should handle uppercase formats correctly', () => {
        // Arrange & Act & Assert
        expect(getContentTypeForFormat('PNG')).toBe('image/png');
        expect(getContentTypeForFormat('WEBP')).toBe('image/webp');
      });
    });
  });

  // Test the new factory pattern implementation
  describe('Factory API', () => {
    // Mock logger for testing
    const mockLogger = {
      debug: vi.fn(),
    };

    // Mock client detection utilities for testing
    const mockClientDetectionUtils = {
      getOptimalFormat: vi.fn(),
    };

    // Reset mocks before each test
    beforeEach(() => {
      mockLogger.debug.mockReset();
      mockClientDetectionUtils.getOptimalFormat.mockReset();
    });

    describe('createFormatUtils', () => {
      it('should create FormatUtils instance with dependencies', () => {
        // Act
        const formatUtils = createFormatUtils({
          logger: mockLogger,
          clientDetectionUtils: mockClientDetectionUtils,
        });

        // Assert
        expect(formatUtils).toBeDefined();
        expect(typeof formatUtils.determineFormat).toBe('function');
        expect(typeof formatUtils.getContentTypeForFormat).toBe('function');
      });

      it('should create FormatUtils instance without dependencies', () => {
        // Act
        const formatUtils = createFormatUtils();

        // Assert
        expect(formatUtils).toBeDefined();
        expect(typeof formatUtils.determineFormat).toBe('function');
      });
    });

    describe('determineFormat', () => {
      it('should use specified format when provided', () => {
        // Arrange
        const formatUtils = createFormatUtils({ logger: mockLogger });
        const request = new Request('https://example.com/image.jpg');
        const formatParam = 'webp';

        // Act
        const result = formatUtils.determineFormat(request, formatParam);

        // Assert
        expect(result).toBe('webp');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'FormatUtils',
          'Using specified format',
          expect.objectContaining({ formatParam: 'webp' })
        );
      });

      it('should use clientDetectionUtils when available', () => {
        // Arrange
        mockClientDetectionUtils.getOptimalFormat.mockReturnValue('avif');

        const formatUtils = createFormatUtils({
          logger: mockLogger,
          clientDetectionUtils: mockClientDetectionUtils,
        });

        const request = new Request('https://example.com/image.jpg', {
          headers: {
            'User-Agent': 'Chrome/95.0',
            Accept: 'image/avif,image/webp',
          },
        });

        // Act
        const result = formatUtils.determineFormat(request, null);

        // Assert
        expect(result).toBe('avif');
        expect(mockClientDetectionUtils.getOptimalFormat).toHaveBeenCalledWith(
          'Chrome/95.0',
          'image/avif,image/webp'
        );
        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it('should fallback to Accept header parsing when clientDetectionUtils not available', () => {
        // Arrange
        const formatUtils = createFormatUtils({ logger: mockLogger });
        const request = new Request('https://example.com/image.jpg', {
          headers: {
            Accept: 'image/webp,image/apng,image/*',
          },
        });

        // Act
        const result = formatUtils.determineFormat(request, null);

        // Assert
        expect(result).toBe('webp');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'FormatUtils',
          'Determined format from Accept header',
          expect.objectContaining({
            accept: 'image/webp,image/apng,image/*',
            format: 'webp',
          })
        );
      });
    });

    describe('getContentTypeForFormat', () => {
      it('should map format to correct content type', () => {
        // Arrange
        const formatUtils = createFormatUtils({ logger: mockLogger });

        // Act
        const result = formatUtils.getContentTypeForFormat('avif');

        // Assert
        expect(result).toBe('image/avif');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'FormatUtils',
          'Mapped format to content type',
          expect.objectContaining({
            format: 'avif',
            contentType: 'image/avif',
          })
        );
      });

      it('should handle unknown formats', () => {
        // Arrange
        const formatUtils = createFormatUtils({ logger: mockLogger });

        // Act
        const result = formatUtils.getContentTypeForFormat('unknown');

        // Assert
        expect(result).toBe('image/jpeg');
        expect(mockLogger.debug).toHaveBeenCalled();
      });
    });
  });
});
