import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageOptionsFactory } from '../../src/utils/optionsFactory';
// These imports are used for mocking but not directly referenced
/* eslint-disable @typescript-eslint/no-unused-vars */
import { hasClientHints } from '../../src/utils/clientHints';
import { hasCfDeviceType } from '../../src/utils/deviceUtils';
import { getDeviceTypeFromUserAgent } from '../../src/utils/userAgentUtils';
/* eslint-enable @typescript-eslint/no-unused-vars */
import { determineFormat } from '../../src/utils/formatUtils';

// Mock dependencies
vi.mock('../../src/utils/clientHints', () => ({
  hasClientHints: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/utils/deviceUtils', () => ({
  hasCfDeviceType: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/utils/userAgentUtils', () => ({
  getDeviceTypeFromUserAgent: vi.fn().mockReturnValue('desktop'),
}));

vi.mock('../../src/utils/formatUtils', () => ({
  determineFormat: vi.fn().mockReturnValue('webp'),
}));

vi.mock('../../src/utils/loggerUtils', () => ({
  debug: vi.fn(),
}));

describe('ImageOptionsFactory', () => {
  let factory: ImageOptionsFactory;
  // Using a more specific type than any
  let testConfig: {
    derivatives: Record<string, Record<string, unknown>>;
    responsive: {
      availableWidths: number[];
      breakpoints: number[];
      deviceWidths: Record<string, number>;
      deviceMinWidthMap: Record<string, number>;
      quality: number;
      fit: string;
      metadata: string;
      format: string;
    };
    defaults: {
      quality: number;
      fit: string;
      format: string;
      metadata: string;
    };
  };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create a test configuration
    testConfig = {
      derivatives: {
        thumbnail: {
          width: 320,
          height: 150,
          quality: 85,
          fit: 'scale-down',
          metadata: 'copyright',
          sharpen: 1,
        },
        avatar: {
          width: 180,
          height: 180,
          quality: 90,
          fit: 'cover',
          metadata: 'none',
          gravity: 'face',
        },
      },
      responsive: {
        availableWidths: [320, 640, 768, 960, 1024, 1440, 1920],
        breakpoints: [320, 768, 960, 1440, 1920],
        deviceWidths: {
          mobile: 480,
          tablet: 768,
          desktop: 1440,
        },
        deviceMinWidthMap: {
          mobile: 320,
          tablet: 768,
          'large-desktop': 1920,
          desktop: 960,
        },
        quality: 85,
        fit: 'scale-down',
        metadata: 'copyright',
        format: 'auto',
      },
      defaults: {
        quality: 85,
        fit: 'scale-down',
        format: 'auto',
        metadata: 'copyright',
      },
    };

    // Create the factory
    factory = new ImageOptionsFactory(testConfig);
  });

  describe('Derivative Strategy', () => {
    it('should apply derivative template when derivative parameter is present', async () => {
      // Arrange
      const request = new Request('https://example.com/image.jpg');
      const urlParams = new URLSearchParams('derivative=thumbnail');

      // Act
      const options = await factory.createImageOptions(request, urlParams);

      // Assert
      expect(options).toEqual(
        expect.objectContaining({
          width: 320,
          height: 150,
          quality: 85,
          fit: 'scale-down',
          metadata: 'copyright',
          sharpen: 1,
          source: 'derivative-thumbnail',
          derivative: 'thumbnail',
        })
      );
    });

    it('should not apply derivative template for unknown derivatives', async () => {
      // Arrange
      const request = new Request('https://example.com/image.jpg');
      const urlParams = new URLSearchParams('derivative=unknown');

      // Act
      const options = await factory.createImageOptions(request, urlParams);

      // Assert
      expect(options).not.toHaveProperty('source', 'derivative-unknown');
      // Should fall back to explicit params strategy
      expect(options).toHaveProperty('quality', 85); // From defaults
    });
  });

  describe('Explicit Parameters Strategy', () => {
    it('should apply explicit parameters from URL', async () => {
      // Arrange
      const request = new Request('https://example.com/image.jpg');
      const urlParams = new URLSearchParams('width=500&height=300&quality=90&fit=cover');

      // Act
      const options = await factory.createImageOptions(request, urlParams);

      // Assert
      expect(options).toEqual(
        expect.objectContaining({
          width: 500,
          height: 300,
          quality: 90,
          fit: 'cover',
          source: 'explicit-params',
        })
      );
    });

    it('should handle width=auto parameter', async () => {
      // Arrange
      const request = new Request('https://example.com/image.jpg');
      const urlParams = new URLSearchParams('width=auto&quality=90');

      // Act
      const options = await factory.createImageOptions(request, urlParams);

      // Assert
      expect(options).toEqual(
        expect.objectContaining({
          width: 'auto',
          quality: 90,
          source: 'explicit-params',
        })
      );
    });

    it('should use determineFormat when format is not specified', async () => {
      // Arrange
      const request = new Request('https://example.com/image.jpg');
      const urlParams = new URLSearchParams('width=500');

      // Mock determineFormat to return 'webp'
      (determineFormat as jest.Mock).mockReturnValue('webp');

      // Act
      const options = await factory.createImageOptions(request, urlParams);

      // Assert
      expect(options.format).toBe('webp');
      expect(determineFormat).toHaveBeenCalledWith(request, null);
    });
  });
});
