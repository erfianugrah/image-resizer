import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TransformImageCommand,
  ImageTransformContext,
} from '../../../src/domain/commands/TransformImageCommand';

// Mock dependencies to avoid circular dependencies during testing
vi.mock('../../../src/services/debugService', async () => ({
  addDebugHeaders: vi.fn((response, _, __) => response),
}));

vi.mock('../../../src/utils/loggerUtils', async () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../src/utils/cacheUtils', async () => ({
  determineCacheConfig: vi.fn(() => ({
    cacheability: true,
    ttl: {
      ok: 86400,
      redirects: 86400,
      clientError: 60,
      serverError: 0,
    },
    method: 'cache-api',
  })),
}));

// Mock the ServiceRegistry to avoid any service resolution issues
vi.mock('../../../src/core/serviceRegistry', () => {
  return {
    ServiceRegistry: {
      getInstance: vi.fn(() => ({
        resolve: vi.fn((serviceId) => {
          if (serviceId === 'IConfigManager') {
            return {
              getConfig: vi.fn(() => ({
                environment: 'test',
                cache: {
                  method: 'cache-api',
                  debug: false,
                  ttl: {
                    ok: 86400,
                    redirects: 86400,
                    clientError: 60,
                    serverError: 0,
                  },
                },
              })),
            };
          }
          return {};
        }),
      })),
    },
  };
});

describe('TransformImageCommand', () => {
  let mockRequest: Request;
  let mockContext: ImageTransformContext;

  beforeEach(() => {
    // Create fresh mock request for each test
    mockRequest = new Request('https://example.com/image.jpg');

    // Basic context with minimal settings
    mockContext = {
      request: mockRequest,
      options: {
        width: 800,
        height: 600,
        format: 'webp',
        quality: 80,
      },
      config: {
        mode: 'test',
        version: '1.0.0-test',
        cache: {
          method: 'cache-api',
          debug: false,
        },
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Reset fetch mock
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('Image data', { status: 200 }))
    );
  });

  it('should successfully transform an image', async () => {
    // Arrange
    const command = new TransformImageCommand(mockContext);

    // Act
    const result = await command.execute();

    // Assert
    expect(result.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      mockRequest,
      expect.objectContaining({
        cf: expect.objectContaining({
          image: expect.objectContaining({
            width: 800,
            height: 600,
            format: 'webp',
            quality: 80,
          }),
        }),
      })
    );
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    vi.mocked(fetch).mockRejectedValue(new Error('Fetch error'));
    const command = new TransformImageCommand(mockContext);

    // Act
    const result = await command.execute();

    // Assert
    expect(result.status).toBe(500);
    expect(await result.text()).toContain('Error transforming image');
  });

  it('should validate image options correctly', async () => {
    // Arrange
    mockContext.options.width = 9; // Below minimum width
    const command = new TransformImageCommand(mockContext);

    // Act
    const result = await command.execute();

    // Assert - validation errors now return 400 Bad Request
    expect(result.status).toBe(400);
    expect(await result.text()).toContain('Width must be between 10 and 8192 pixels');
  });

  it('should handle "auto" width specially', async () => {
    // Arrange
    mockContext.options.width = 'auto';
    const command = new TransformImageCommand(mockContext);

    // Act
    const result = await command.execute();

    // Assert
    expect(result.status).toBe(200);
    // The auto width should not cause a validation error
    const fetchCall = vi.mocked(fetch).mock.calls[0][1];
    expect(fetchCall.cf.image).not.toHaveProperty('width');
  });
});
