import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  transformImage,
  getBestImageFormat,
  shouldUseResponsiveSizing,
} from '../../src/services/imageTransformationService';
// Import type for mocking in test
import type { TransformImageCommand as _TransformImageCommand } from '../../src/domain/commands/TransformImageCommand';

type MockTransformImageCommand = {
  mock: {
    results: Array<{
      value: { execute: ReturnType<typeof vi.fn> };
    }>;
  };
  mockImplementationOnce: (callback: () => unknown) => void;
};

// Mock TransformImageCommand dynamically
vi.mock('../../src/domain/commands/TransformImageCommand', async () => {
  const mockResponse = new Response('Mocked transformed image', { status: 200 });

  return {
    TransformImageCommand: vi.fn().mockImplementation(() => ({
      execute: vi.fn().mockResolvedValue(mockResponse),
    })),
  };
});

vi.mock('../../src/utils/loggerUtils', async () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

describe('ImageTransformationService', () => {
  let mockRequest: Request;

  beforeEach(() => {
    mockRequest = new Request('https://example.com/test.jpg');
    vi.clearAllMocks();
  });

  describe('transformImage', () => {
    it('should create and execute a command', async () => {
      // Arrange
      const options = { width: 600, height: 400 };
      const debugInfo = { isEnabled: true };
      const config = { mode: 'test' };

      // Act
      const result = await transformImage(mockRequest, options, [], debugInfo, config);

      // Assert
      expect(result.status).toBe(200);

      // Check that the command was imported and instantiated correctly
      const { TransformImageCommand } = await import(
        '../../src/domain/commands/TransformImageCommand'
      );
      expect(TransformImageCommand).toHaveBeenCalledWith({
        request: mockRequest,
        options,
        pathPatterns: [],
        debugInfo,
        config,
      });

      // Check that the command's execute method was called
      const mockCommand = (TransformImageCommand as unknown as MockTransformImageCommand).mock
        .results[0].value;
      expect(mockCommand.execute).toHaveBeenCalled();
    });

    it('should handle errors and rethrow them', async () => {
      // Arrange
      const options = { width: 600, height: 400 };

      // Mock the TransformImageCommand to throw an error
      const { TransformImageCommand } = await import(
        '../../src/domain/commands/TransformImageCommand'
      );
      (TransformImageCommand as unknown as MockTransformImageCommand).mockImplementationOnce(
        () => ({
          execute: () => {
            throw new Error('Test error');
          },
        })
      );

      // Act & Assert
      await expect(transformImage(mockRequest, options)).rejects.toThrow('Test error');
    });
  });

  describe('getBestImageFormat', () => {
    it('should return avif for browsers that support it', () => {
      // Arrange
      const headers = new Headers({
        Accept: 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
      });
      mockRequest = new Request('https://example.com/test.jpg', { headers });

      // Act
      const result = getBestImageFormat(mockRequest);

      // Assert
      expect(result).toBe('avif');
    });

    it('should return webp for browsers that support it but not avif', () => {
      // Arrange
      const headers = new Headers({
        Accept: 'image/webp,image/png,image/*,*/*;q=0.8',
      });
      mockRequest = new Request('https://example.com/test.jpg', { headers });

      // Act
      const result = getBestImageFormat(mockRequest);

      // Assert
      expect(result).toBe('webp');
    });

    it('should return auto for browsers with no specific format preference', () => {
      // Arrange
      const headers = new Headers({
        Accept: 'image/*,*/*;q=0.8',
      });
      mockRequest = new Request('https://example.com/test.jpg', { headers });

      // Act
      const result = getBestImageFormat(mockRequest);

      // Assert
      expect(result).toBe('auto');
    });
  });

  describe('shouldUseResponsiveSizing', () => {
    it('should return true for auto width with client hints', () => {
      // Act
      const result = shouldUseResponsiveSizing('auto', true);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for undefined width with client hints', () => {
      // Act
      const result = shouldUseResponsiveSizing(undefined, true);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for specific width', () => {
      // Act
      const result = shouldUseResponsiveSizing(800, true);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when client hints are not available', () => {
      // Act
      const result = shouldUseResponsiveSizing('auto', false);

      // Assert
      expect(result).toBe(false);
    });
  });
});
