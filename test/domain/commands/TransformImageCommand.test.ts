import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TransformImageCommand,
  ImageTransformContext,
  TransformImageCommandDependencies,
} from '../../../src/domain/commands/TransformImageCommand';
import { ValidationError } from '../../../src/types/utils/errors';

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

    // Create a mock validation service that returns an invalid result
    const mockValidationService = {
      validateOptions: vi.fn().mockImplementation(() => {
        console.log('Mock validation service called');
        const validationError = new ValidationError(
          'Width must be between 10 and 8192 pixels',
          'width',
          9
        );
        return {
          isValid: false,
          errors: [validationError],
          options: mockContext.options,
        };
      }),
      getDefaultValidationConfig: vi.fn(),
      createError: vi.fn(),
    };

    // Log everything for debugging
    console.log('Setting up test for validation');

    // Create dependencies with the mock validation service
    const mockDependencies: TransformImageCommandDependencies = {
      logger: {
        debug: vi.fn().mockImplementation((module, message, data) => {
          console.log(`DEBUG: ${module} - ${message}`, data);
        }),
        error: vi.fn().mockImplementation((module, message, data) => {
          console.log(`ERROR: ${module} - ${message}`, data);
        }),
      },
      validationService: mockValidationService,
      cacheUtils: {
        determineCacheConfig: vi.fn().mockResolvedValue({
          cacheability: true,
          ttl: { ok: 86400 },
        }),
      },
      clientDetection: {
        hasCfDeviceType: vi.fn().mockReturnValue(false),
        getCfDeviceType: vi.fn().mockReturnValue(''),
        hasClientHints: vi.fn().mockReturnValue(false),
        getDeviceTypeFromUserAgent: vi.fn().mockReturnValue('desktop'),
        normalizeDeviceType: vi.fn().mockReturnValue('desktop'),
      },
    };

    const command = new TransformImageCommand(mockContext, mockDependencies);

    // Act
    console.log('Executing command');
    const result = await command.execute();
    console.log('Result status:', result.status);
    console.log('Result text:', await result.clone().text());

    // Assert - validation errors should return 400 Bad Request
    expect(result.status).toBe(400);
    expect(await result.text()).toContain('Width must be between 10 and 8192 pixels');
    // Verify the validation service was called
    expect(mockValidationService.validateOptions).toHaveBeenCalled();
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
