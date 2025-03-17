import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClientDetectionUtils } from '../../src/utils/clientDetectionUtils';

describe('ClientDetectionUtils Factory', () => {
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  // Reset the mocks before each test
  beforeEach(() => {
    mockLogger.debug.mockReset();
    mockLogger.error.mockReset();
  });

  describe('browser capabilities detection', () => {
    it('should detect Chrome browser capabilities', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36';

      // Act
      const capabilities = clientDetection.detectBrowserCapabilities(chromeUA);

      // Assert
      expect(capabilities.name).toBe('chrome');
      expect(capabilities.webp).toBe(true);
      expect(capabilities.avif).toBe(true);
      expect(capabilities.mobile).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should detect mobile device from user agent', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const mobileUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1';

      // Act
      const deviceType = clientDetection.getDeviceTypeFromUserAgent(mobileUA);

      // Assert
      expect(deviceType).toBe('mobile');
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('client hints', () => {
    it('should detect viewport width from client hints', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const mockHeaders = new Headers();
      mockHeaders.set('Sec-CH-Viewport-Width', '1280');
      const mockRequest = new Request('https://example.com', {
        headers: mockHeaders,
      });

      // Act
      const viewportWidth = clientDetection.getViewportWidth(mockRequest);

      // Assert
      expect(viewportWidth).toBe(1280);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should return null when no client hints are present', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const mockRequest = new Request('https://example.com');

      // Act
      const viewportWidth = clientDetection.getViewportWidth(mockRequest);

      // Assert
      expect(viewportWidth).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('responsive width calculation', () => {
    it('should determine responsive width based on client hints', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const mockHeaders = new Headers();
      mockHeaders.set('Sec-CH-Viewport-Width', '1280');
      mockHeaders.set('Sec-CH-DPR', '2');
      const mockRequest = new Request('https://example.com', {
        headers: mockHeaders,
      });

      // Act
      const responsiveWidth = clientDetection.getResponsiveWidth(mockRequest, 'desktop');

      // Assert
      expect(responsiveWidth).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalled(); // Just verify logging happened, don't count exact times
    });

    it('should snap width to nearest breakpoint', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const width = 1025;
      const breakpoints = [640, 768, 1024, 1280, 1536];

      // Act
      const snappedWidth = clientDetection.snapToBreakpoint(width, breakpoints);

      // Assert
      expect(snappedWidth).toBe(1024); // Should snap to 1024 as it's closer than 1280
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('optimal format selection', () => {
    it('should select avif for modern browsers that support it', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36';
      const acceptHeader = 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8';

      // Act
      const format = clientDetection.getOptimalFormat(chromeUA, acceptHeader);

      // Assert
      expect(format).toBe('avif');
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should fall back to webp for browsers that support webp but not avif', () => {
      // Arrange
      const clientDetection = createClientDetectionUtils({ logger: mockLogger });
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36';
      const acceptHeader = 'image/webp,image/png,image/jpeg,*/*;q=0.8';

      // Act
      const format = clientDetection.getOptimalFormat(chromeUA, acceptHeader);

      // Assert
      expect(format).toBe('webp');
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
