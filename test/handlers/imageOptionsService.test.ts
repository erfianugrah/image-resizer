/**
 * Tests for the ImageOptionsService
 * Specifically focused on R2 bucket integration
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createImageOptionsService } from '../../src/handlers/imageOptionsService';
import {
  createMockLogger,
  createMockConfigManager,
  createMockClientDetectionUtils,
  createMockUrlParamUtils,
} from '../utils/mockFactories';

describe('ImageOptionsService with R2 paths', () => {
  const createMockDependencies = () => {
    const logger = createMockLogger();
    const config = createMockConfigManager();
    const clientDetection = createMockClientDetectionUtils();
    const urlUtils = {
      extractImageParams: vi.fn(),
      snapToBreakpoint: vi.fn().mockImplementation((width, breakpoints) => {
        // Simple implementation for tests
        const sorted = [...breakpoints].sort((a, b) => a - b);
        for (const point of sorted) {
          if (width <= point) return point;
        }
        return sorted[sorted.length - 1];
      }),
    };
    const optionsFactory = {
      create: vi.fn().mockReturnValue({
        createImageOptions: vi.fn().mockResolvedValue({
          width: 800,
          quality: 80,
          format: 'auto',
        }),
      }),
    };

    return {
      logger,
      config,
      clientDetection,
      urlUtils,
      optionsFactory,
    };
  };

  const createTestRequest = (headers = {}, url = 'https://example.com/image.jpg') => {
    return new Request(url, {
      headers: new Headers(headers),
    });
  };

  const createR2Request = (headers = {}, bucketName = 'my-images') => {
    return new Request(`https://example.com/r2/${bucketName}/image.jpg`, {
      headers: new Headers(headers),
    });
  };

  let dependencies: ReturnType<typeof createMockDependencies>;
  let service: ReturnType<typeof createImageOptionsService>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    service = createImageOptionsService(dependencies);
  });

  test('should extract image params from R2 paths', async () => {
    // Arrange
    const request = createR2Request();
    const urlParams = new URLSearchParams();
    const pathname = '/r2/my-images/image.jpg';

    // Act
    await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(dependencies.urlUtils.extractImageParams).toHaveBeenCalledWith(urlParams, pathname);
  });

  test('should handle R2 paths with width=auto parameter', async () => {
    // Arrange
    const request = createR2Request({
      'Viewport-Width': '1200',
      DPR: '2',
    });
    const urlParams = new URLSearchParams('width=auto');
    const pathname = '/r2/my-images/image.jpg';

    // Mock client hints detection
    dependencies.clientDetection.hasClientHints.mockReturnValue(true);
    dependencies.clientDetection.getViewportWidth.mockReturnValue(1200);
    dependencies.clientDetection.getDevicePixelRatio.mockReturnValue(2);

    // Mock options factory to return width=auto
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 'auto',
        quality: 80,
        format: 'auto',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.width).not.toBe('auto');
    expect(typeof result.width).toBe('number');
    expect(result.source).toBe('client-hints-responsive');
  });

  test('should apply appropriate breakpoint for R2 images with width=auto', async () => {
    // Arrange
    const request = createR2Request({
      'Viewport-Width': '1200',
      DPR: '2',
    });
    const urlParams = new URLSearchParams('width=auto');
    const pathname = '/r2/my-images/image.jpg';

    // Mock client hints detection
    dependencies.clientDetection.hasClientHints.mockReturnValue(true);
    dependencies.clientDetection.getViewportWidth.mockReturnValue(1200);
    dependencies.clientDetection.getDevicePixelRatio.mockReturnValue(2);

    // Mock options factory to return width=auto
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 'auto',
        quality: 80,
        format: 'auto',
      }),
    });

    // Mock config to include breakpoints
    dependencies.config.getConfig.mockReturnValue({
      responsive: {
        breakpoints: [320, 768, 1024, 1440, 1920],
      },
    });

    // Mock snapToBreakpoint to verify it's called with correct parameters
    dependencies.urlUtils.snapToBreakpoint.mockReturnValue(1920);

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.width).toBe(1920);
    expect(dependencies.urlUtils.snapToBreakpoint).toHaveBeenCalledWith(
      2400,
      [320, 768, 1024, 1440, 1920]
    );
  });

  test('should fall back to CF-Device-Type for R2 paths when client hints are not available', async () => {
    // Arrange
    const request = createR2Request({
      'CF-Device-Type': 'mobile',
    });
    const urlParams = new URLSearchParams('width=auto');
    const pathname = '/r2/my-images/image.jpg';

    // Mock client hints detection (not available)
    dependencies.clientDetection.hasClientHints.mockReturnValue(false);
    dependencies.clientDetection.hasCfDeviceType.mockReturnValue(true);

    // Mock device info
    dependencies.clientDetection.getDeviceInfo.mockReturnValue({ width: 480, type: 'mobile' });

    // Mock options factory to return width=auto
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 'auto',
        quality: 80,
        format: 'auto',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.width).toBe(480);
    expect(result.source).toBe('cf-device-responsive');
  });

  test('should fall back to User-Agent detection for R2 paths when no other signals available', async () => {
    // Arrange
    const request = createR2Request({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });
    const urlParams = new URLSearchParams('width=auto');
    const pathname = '/r2/my-images/image.jpg';

    // Mock client hints and CF-Device-Type detection (not available)
    dependencies.clientDetection.hasClientHints.mockReturnValue(false);
    dependencies.clientDetection.hasCfDeviceType.mockReturnValue(false);
    dependencies.clientDetection.getDeviceTypeFromUserAgent.mockReturnValue('mobile');

    // Mock options factory to return width=auto
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 'auto',
        quality: 80,
        format: 'auto',
      }),
    });

    // Mock config for device widths
    dependencies.config.getConfig.mockReturnValue({
      responsive: {
        deviceWidths: {
          mobile: 480,
          tablet: 768,
          desktop: 1440,
        },
      },
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.width).toBe(480);
    expect(result.source).toBe('user-agent-responsive');
  });

  test('should handle errors gracefully and return empty options for R2 paths', async () => {
    // Arrange
    const request = createR2Request();
    const urlParams = new URLSearchParams();
    const pathname = '/r2/my-images/image.jpg';

    // Force an error in the dependencies
    dependencies.urlUtils.extractImageParams.mockImplementation(() => {
      throw new Error('Test error');
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result).toEqual({});
    expect(dependencies.logger.error).toHaveBeenCalled();
  });

  test('should handle R2 paths with different bucket names', async () => {
    // Arrange
    const request = createR2Request({}, 'user-uploads');
    const urlParams = new URLSearchParams();
    const pathname = '/r2/user-uploads/profile.jpg';

    // Act
    await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(dependencies.urlUtils.extractImageParams).toHaveBeenCalledWith(urlParams, pathname);
  });
});

describe('ImageOptionsService with CDN-CGI pattern for R2', () => {
  const createMockDependencies = () => {
    const logger = createMockLogger();
    const config = createMockConfigManager();
    const clientDetection = createMockClientDetectionUtils();
    const urlUtils = {
      extractImageParams: vi.fn(),
      snapToBreakpoint: vi.fn().mockReturnValue(1024),
    };
    const optionsFactory = {
      create: vi.fn().mockReturnValue({
        createImageOptions: vi.fn().mockResolvedValue({
          width: 800,
          quality: 80,
          format: 'auto',
        }),
      }),
    };

    return {
      logger,
      config,
      clientDetection,
      urlUtils,
      optionsFactory,
    };
  };

  const createCdnCgiR2Request = (options = {}, bucketName = 'my-images') => {
    // Convert options to URL parameters format
    const params = Object.entries(options)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    const url = `https://example.com/cdn-cgi/image/${params}/r2/${bucketName}/image.jpg`;
    return new Request(url, {
      headers: new Headers(),
    });
  };

  let dependencies: ReturnType<typeof createMockDependencies>;
  let service: ReturnType<typeof createImageOptionsService>;

  beforeEach(() => {
    dependencies = createMockDependencies();
    service = createImageOptionsService(dependencies);
  });

  test('should extract parameters from CDN-CGI pattern with R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({ width: 800, format: 'webp' });
    const urlParams = new URLSearchParams();
    const pathname = '/cdn-cgi/image/width=800,format=webp/r2/my-images/image.jpg';

    // Act
    await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(dependencies.urlUtils.extractImageParams).toHaveBeenCalledWith(urlParams, pathname);
  });

  test('should handle width=auto in CDN-CGI pattern with R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({ width: 'auto', format: 'webp' });
    const urlParams = new URLSearchParams('width=auto');
    const pathname = '/cdn-cgi/image/width=auto,format=webp/r2/my-images/image.jpg';

    // Mock client hints detection
    dependencies.clientDetection.hasClientHints.mockReturnValue(true);
    dependencies.clientDetection.getViewportWidth.mockReturnValue(1000);
    dependencies.clientDetection.getDevicePixelRatio.mockReturnValue(2);

    // Mock options factory to return width=auto
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 'auto',
        format: 'webp',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.width).not.toBe('auto');
    expect(typeof result.width).toBe('number');
    expect(result.source).toBe('client-hints-responsive');
  });

  test('should respect quality parameter in CDN-CGI pattern with R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({ width: 800, quality: 90, format: 'webp' });
    const urlParams = new URLSearchParams();
    const pathname = '/cdn-cgi/image/width=800,quality=90,format=webp/r2/my-images/image.jpg';

    // Setup options factory to pass through the quality parameter
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 800,
        quality: 90,
        format: 'webp',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.quality).toBe(90);
  });

  test('should handle derivative parameter in CDN-CGI pattern with R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({ derivative: 'thumbnail' });
    const urlParams = new URLSearchParams('derivative=thumbnail');
    const pathname = '/cdn-cgi/image/derivative=thumbnail/r2/my-images/image.jpg';

    // Setup options factory to handle the derivative
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 200,
        height: 200,
        fit: 'cover',
        quality: 80,
        derivative: 'thumbnail',
        source: 'derivative-thumbnail',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result.derivative).toBe('thumbnail');
    expect(result.source).toBe('derivative-thumbnail');
  });

  test('should handle errors in CDN-CGI pattern with R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({ width: 800 });
    const urlParams = new URLSearchParams();
    const pathname = '/cdn-cgi/image/width=800/r2/my-images/image.jpg';

    // Force an error in options factory
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockImplementation(() => {
        throw new Error('Test error in options factory');
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result).toEqual({});
    expect(dependencies.logger.error).toHaveBeenCalled();
  });

  test('should handle complex CDN-CGI pattern with multiple parameters for R2 path', async () => {
    // Arrange
    const request = createCdnCgiR2Request({
      width: 800,
      height: 600,
      fit: 'cover',
      quality: 85,
      format: 'webp',
      dpr: 2,
      metadata: 'none',
    });
    const urlParams = new URLSearchParams();
    const pathname =
      '/cdn-cgi/image/width=800,height=600,fit=cover,quality=85,format=webp,dpr=2,metadata=none/r2/my-images/image.jpg';

    // Setup options factory to return all parameters
    dependencies.optionsFactory.create.mockReturnValue({
      createImageOptions: vi.fn().mockResolvedValue({
        width: 800,
        height: 600,
        fit: 'cover',
        quality: 85,
        format: 'webp',
        dpr: 2,
        metadata: 'none',
      }),
    });

    // Act
    const result = await service.determineImageOptions(request, urlParams, pathname);

    // Assert
    expect(result).toEqual({
      width: 800,
      height: 600,
      fit: 'cover',
      quality: 85,
      format: 'webp',
      dpr: 2,
      metadata: 'none',
    });
  });
});
