import { describe, it, expect } from 'vitest';
import { determineFormat, getContentTypeForFormat } from '../../src/utils/formatUtils';

describe('formatUtils', () => {
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
