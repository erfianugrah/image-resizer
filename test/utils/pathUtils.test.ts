import { describe, it, expect } from 'vitest';
import {
  getDerivativeFromPath,
  isImagePath,
  getFilenameFromPath,
  findMatchingPathPattern,
  matchPathWithCaptures,
} from '../../src/utils/pathUtils';

describe('pathUtils', () => {
  describe('getDerivativeFromPath', () => {
    it('should detect derivative from the first path segment', () => {
      // Arrange
      const path = '/thumbnail/image.jpg';
      const pathTemplates = {
        thumbnail: 'thumbnail',
        header: 'header',
        avatar: 'avatar',
      };

      // Act
      const result = getDerivativeFromPath(path, pathTemplates);

      // Assert
      expect(result).toBe('thumbnail');
    });

    it('should detect derivative from template mapping in the first segment', () => {
      // Arrange
      const path = '/profile-pictures/user1.jpg';
      const pathTemplates = {
        'profile-pictures': 'avatar',
        'hero-banners': 'header',
      };

      // Act
      const result = getDerivativeFromPath(path, pathTemplates);

      // Assert
      expect(result).toBe('avatar');
    });

    it('should detect derivative from path inclusion', () => {
      // Arrange
      const path = '/images/thumbnail/photo.jpg';
      const pathTemplates = {
        thumbnail: 'thumbnail',
        header: 'header',
      };

      // Act
      const result = getDerivativeFromPath(path, pathTemplates);

      // Assert
      expect(result).toBe('thumbnail');
    });

    it('should use default templates when none are provided', () => {
      // Arrange
      const path = '/avatar/photo.jpg';

      // Act
      const result = getDerivativeFromPath(path);

      // Assert
      expect(result).toBe('avatar');
    });

    it('should return null when no derivative is found', () => {
      // Arrange
      const path = '/images/photo.jpg';
      const pathTemplates = {
        thumbnail: 'thumbnail',
        header: 'header',
      };

      // Act
      const result = getDerivativeFromPath(path, pathTemplates);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('isImagePath', () => {
    it('should return true for valid image extensions', () => {
      expect(isImagePath('/path/to/image.jpg')).toBeTruthy();
      expect(isImagePath('/path/to/image.jpeg')).toBeTruthy();
      expect(isImagePath('/path/to/image.png')).toBeTruthy();
      expect(isImagePath('/path/to/image.gif')).toBeTruthy();
      expect(isImagePath('/path/to/image.webp')).toBeTruthy();
      expect(isImagePath('/path/to/image.svg')).toBeTruthy();
      expect(isImagePath('/path/to/image.avif')).toBeTruthy();
      expect(isImagePath('/path/to/image.JPG')).toBeTruthy();
    });

    it('should return false for non-image extensions', () => {
      expect(isImagePath('/path/to/file.pdf')).toBeFalsy();
      expect(isImagePath('/path/to/file.txt')).toBeFalsy();
      expect(isImagePath('/path/to/file.html')).toBeFalsy();
      expect(isImagePath('/path/to/file')).toBeFalsy();
    });
  });

  describe('getFilenameFromPath', () => {
    it('should extract filename from path', () => {
      expect(getFilenameFromPath('/path/to/image.jpg')).toBe('image.jpg');
      expect(getFilenameFromPath('/image.jpg')).toBe('image.jpg');
      expect(getFilenameFromPath('image.jpg')).toBe('image.jpg');
    });
  });

  describe('findMatchingPathPattern', () => {
    it('should find matching pattern', () => {
      // Arrange
      const path = '/images/user123/profile.jpg';
      const patterns = [
        {
          name: 'user-profile',
          matcher: '^/images/user\\d+/.*\\.jpg$',
        },
        {
          name: 'product',
          matcher: '^/products/.*$',
        },
      ];

      // Act
      const result = findMatchingPathPattern(path, patterns);

      // Assert
      expect(result).toEqual(patterns[0]);
    });

    it('should return undefined when no pattern matches', () => {
      // Arrange
      const path = '/other/path.jpg';
      const patterns = [
        {
          name: 'user-profile',
          matcher: '^/images/user\\d+/.*\\.jpg$',
        },
      ];

      // Act
      const result = findMatchingPathPattern(path, patterns);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('matchPathWithCaptures', () => {
    it('should capture named groups from path', () => {
      // Arrange
      const path = '/users/123/photos/456.jpg';
      const patterns = [
        {
          name: 'user-photo',
          matcher: '^/users/(?<userId>\\d+)/photos/(?<photoId>\\d+)\\.jpg$',
          captureGroups: true,
        },
      ];

      // Act
      const result = matchPathWithCaptures(path, patterns);

      // Assert
      expect(result).toEqual({
        pattern: patterns[0],
        captures: {
          '1': '123',
          '2': '456',
          userId: '123',
          photoId: '456',
        },
      });
    });

    it('should return null when no pattern matches', () => {
      // Arrange
      const path = '/other/path.jpg';
      const patterns = [
        {
          name: 'user-photo',
          matcher: '^/users/(?<userId>\\d+)/photos/(?<photoId>\\d+)\\.jpg$',
          captureGroups: true,
        },
      ];

      // Act
      const result = matchPathWithCaptures(path, patterns);

      // Assert
      expect(result).toBeNull();
    });

    it('should match pattern without capture groups', () => {
      // Arrange
      const path = '/static/image.jpg';
      const patterns = [
        {
          name: 'static-image',
          matcher: '^/static/.*\\.jpg$',
          captureGroups: false,
        },
      ];

      // Act
      const result = matchPathWithCaptures(path, patterns);

      // Assert
      expect(result).toEqual({
        pattern: patterns[0],
        captures: {},
      });
    });
  });
});
