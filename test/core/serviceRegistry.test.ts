import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServiceRegistry, getGlobalRegistry } from '../../src/core/serviceRegistry';
import { IServiceRegistry, ServiceRegistration } from '../../src/types/core/serviceRegistry';

// Create a mock R2 object class for testing
class MockR2Object {
  body: ReadableStream<Uint8Array>;
  key: string;
  httpMetadata: { contentType: string };
  size: number;

  constructor(key: string, contentType: string, size: number) {
    this.key = key;
    this.httpMetadata = { contentType };
    this.size = size;

    // Create a simple stream with some bytes for testing
    this.body = new ReadableStream({
      start(controller) {
        const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // Simple JPEG header
        controller.enqueue(bytes);
        controller.close();
      }
    });
  }
}

// Mock a complete R2 bucket for testing
class MockR2Bucket {
  objects: Map<string, MockR2Object>;
  name: string;

  constructor(name: string) {
    this.name = name;
    this.objects = new Map<string, MockR2Object>();
    
    // Add some default test objects
    this.addObject('test.jpg', 'image/jpeg', 100000);
    this.addObject('test.png', 'image/png', 150000);
  }

  addObject(key: string, contentType: string, size: number) {
    this.objects.set(key, new MockR2Object(key, contentType, size));
  }

  async get(key: string): Promise<MockR2Object | null> {
    return this.objects.get(key) || null;
  }

  async head(key: string): Promise<{ key: string; size: number; contentType?: string } | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    
    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata.contentType,
    };
  }
}

// Mock interfaces for services
interface IMockConfigManager {
  getConfig: () => Record<string, any>;
}

interface IMockR2Service {
  getObject: (key: string) => Promise<MockR2Object | null>;
  listObjects: () => Promise<string[]>;
}

interface IMockImageTransformer {
  transform: (imageData: MockR2Object, options: Record<string, any>) => Promise<Uint8Array>;
}

describe('ServiceRegistry', () => {
  let registry: IServiceRegistry;
  let mockR2Bucket: MockR2Bucket;
  const mockEnv = { 
    IMAGES_BUCKET: {} as R2Bucket
  };

  beforeEach(() => {
    // Reset global registry instance before each test
    vi.resetModules();
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');
    mockEnv.IMAGES_BUCKET = mockR2Bucket as unknown as R2Bucket;
    registry = createServiceRegistry();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should register and resolve a singleton service', () => {
    // Arrange
    const configManagerRegistration: ServiceRegistration<IMockConfigManager> = {
      factory: () => ({
        getConfig: () => ({
          mode: 'hybrid',
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET'
          }
        })
      }),
      lifecycle: 'singleton'
    };

    // Act
    registry.register('IMockConfigManager', configManagerRegistration);
    const configManager1 = registry.resolve<IMockConfigManager>('IMockConfigManager');
    const configManager2 = registry.resolve<IMockConfigManager>('IMockConfigManager');

    // Assert
    expect(configManager1).toBeDefined();
    expect(configManager2).toBeDefined();
    expect(configManager1).toBe(configManager2); // Same instance
    expect(configManager1.getConfig()).toHaveProperty('r2.binding_name', 'IMAGES_BUCKET');
  });

  it('should register and resolve a transient service with R2 binding dependencies', () => {
    // Arrange
    const r2ServiceRegistration: ServiceRegistration<IMockR2Service> = {
      factory: () => ({
        getObject: async (key: string) => mockR2Bucket.get(key),
        listObjects: async () => Array.from(mockR2Bucket.objects.keys())
      }),
      lifecycle: 'transient'
    };

    // Act
    registry.register('IMockR2Service', r2ServiceRegistration);
    const r2Service1 = registry.resolve<IMockR2Service>('IMockR2Service');
    const r2Service2 = registry.resolve<IMockR2Service>('IMockR2Service');

    // Assert
    expect(r2Service1).toBeDefined();
    expect(r2Service2).toBeDefined();
    expect(r2Service1).not.toBe(r2Service2); // Different instances for transient
  });

  it('should provide R2 object access through registered service', async () => {
    // Arrange
    const r2ServiceRegistration: ServiceRegistration<IMockR2Service> = {
      factory: () => ({
        getObject: async (key: string) => mockR2Bucket.get(key),
        listObjects: async () => Array.from(mockR2Bucket.objects.keys())
      }),
      lifecycle: 'singleton'
    };

    // Act
    registry.register('IMockR2Service', r2ServiceRegistration);
    const r2Service = registry.resolve<IMockR2Service>('IMockR2Service');
    const testObject = await r2Service.getObject('test.jpg');
    const objectList = await r2Service.listObjects();

    // Assert
    expect(testObject).toBeDefined();
    expect(testObject?.httpMetadata.contentType).toBe('image/jpeg');
    expect(objectList).toContain('test.jpg');
    expect(objectList).toContain('test.png');
  });

  it('should register and resolve a scoped service', async () => {
    // Arrange
    const imageTransformerRegistration: ServiceRegistration<IMockImageTransformer> = {
      factory: () => ({
        transform: async (imageData, options) => {
          // Mock transformation that just returns a new Uint8Array
          return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
        }
      }),
      lifecycle: 'scoped'
    };

    // Act
    registry.register('IMockImageTransformer', imageTransformerRegistration);
    
    // Create two different scopes
    const scope1 = registry.createScope();
    const scope2 = registry.createScope();
    
    const transformer1Scope1 = registry.resolve<IMockImageTransformer>('IMockImageTransformer', scope1);
    const transformer2Scope1 = registry.resolve<IMockImageTransformer>('IMockImageTransformer', scope1);
    const transformerScope2 = registry.resolve<IMockImageTransformer>('IMockImageTransformer', scope2);

    // Assert
    expect(transformer1Scope1).toBeDefined();
    expect(transformer2Scope1).toBeDefined();
    expect(transformerScope2).toBeDefined();
    expect(transformer1Scope1).toBe(transformer2Scope1); // Same instance within a scope
    expect(transformer1Scope1).not.toBe(transformerScope2); // Different instance across scopes
    
    // Clean up scopes
    registry.disposeScope(scope1);
    registry.disposeScope(scope2);
  });

  it('should resolve dependencies for a service with R2 integration', () => {
    // Arrange
    // First register the config manager
    registry.register('IMockConfigManager', {
      factory: () => ({
        getConfig: () => ({
          mode: 'hybrid',
          r2: {
            enabled: true,
            binding_name: 'IMAGES_BUCKET'
          }
        })
      }),
      lifecycle: 'singleton'
    });
    
    // Register R2 service with dependency on config manager
    registry.register('IMockR2Service', {
      factory: (deps) => {
        const configManager = deps.IMockConfigManager as IMockConfigManager;
        const config = configManager.getConfig();
        const bucketName = config.r2.binding_name;
        
        return {
          getObject: async (key: string) => mockR2Bucket.get(key),
          listObjects: async () => Array.from(mockR2Bucket.objects.keys()),
          getBucketName: () => bucketName
        };
      },
      lifecycle: 'singleton',
      dependencies: ['IMockConfigManager']
    });
    
    // Register transformer with dependency on R2 service
    registry.register('IMockImageTransformer', {
      factory: (deps) => {
        const r2Service = deps.IMockR2Service as IMockR2Service & { getBucketName: () => string };
        
        return {
          transform: async (imageData, options) => {
            return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
          },
          getBucketInfo: async () => {
            const objectList = await r2Service.listObjects();
            return {
              bucketName: r2Service.getBucketName(),
              objectCount: objectList.length
            };
          }
        };
      },
      lifecycle: 'singleton',
      dependencies: ['IMockR2Service']
    });

    // Act
    const imageTransformer = registry.resolve<IMockImageTransformer & { 
      getBucketInfo: () => Promise<{ bucketName: string; objectCount: number }> 
    }>('IMockImageTransformer');
    
    // Assert
    expect(imageTransformer).toBeDefined();
    expect(typeof imageTransformer.transform).toBe('function');
    
    // Test dependency chain
    return imageTransformer.getBucketInfo().then(info => {
      expect(info.bucketName).toBe('IMAGES_BUCKET');
      expect(info.objectCount).toBe(2); // test.jpg and test.png
    });
  });

  it('should throw an error when attempting to resolve an unregistered service', () => {
    // Act & Assert
    expect(() => {
      registry.resolve('UnregisteredService');
    }).toThrow(/not registered/);
  });

  it('should properly check if a service is registered', () => {
    // Arrange
    registry.register('RegisteredService', {
      factory: () => ({}),
      lifecycle: 'singleton'
    });

    // Act & Assert
    expect(registry.isRegistered('RegisteredService')).toBe(true);
    expect(registry.isRegistered('UnregisteredService')).toBe(false);
  });

  it('should override an existing registration', () => {
    // Arrange
    registry.register('IMockConfigManager', {
      factory: () => ({
        getConfig: () => ({ version: '1.0.0' })
      }),
      lifecycle: 'singleton'
    });

    // Act - Override registration
    registry.register('IMockConfigManager', {
      factory: () => ({
        getConfig: () => ({ version: '2.0.0' })
      }),
      lifecycle: 'singleton'
    });

    const configManager = registry.resolve<IMockConfigManager>('IMockConfigManager');

    // Assert
    expect(configManager.getConfig().version).toBe('2.0.0');
  });

  it('should throw an error when resolving scoped service without scope', () => {
    // Arrange
    registry.register('ScopedService', {
      factory: () => ({}),
      lifecycle: 'scoped'
    });

    // Act & Assert
    expect(() => {
      registry.resolve('ScopedService');
    }).toThrow(/Scope is required/);
  });

  it('should return global registry instance', () => {
    // Act
    const globalRegistry = getGlobalRegistry();
    
    // Assert
    expect(globalRegistry).toBe(registry);
  });

  it('should handle real R2 service integration pattern from the application', () => {
    // Arrange - Simulate the actual R2 service registration pattern from index.ts
    
    // 1. Register logger
    registry.register('ILogger', {
      factory: () => ({
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        logResponse: vi.fn(),
        logRequest: vi.fn()
      }),
      lifecycle: 'singleton'
    });
    
    // 2. Register config manager
    registry.register('IConfigManager', {
      factory: () => {
        // Mock config with R2 settings
        const configManager = {
          getConfig: () => ({
            mode: 'hybrid',
            r2: {
              enabled: true,
              binding_name: 'IMAGES_BUCKET'
            },
            cache: {
              method: 'cache-api',
              ttl: { ok: 86400 }
            },
            derivatives: {
              mobile: { width: 480, quality: 80 },
              desktop: { width: 1440, quality: 85 }
            },
            environment: 'test'
          }),
          initialize: (env: Record<string, unknown>) => {}
        };
        return configManager;
      },
      lifecycle: 'singleton'
    });
    
    // 3. Register URL transform utils (which handles R2 path transformations)
    registry.register('IUrlTransformUtils', {
      factory: (deps) => {
        const logger = deps.ILogger;
        
        return {
          transformUrlToImageDelivery: vi.fn((url: string) => url),
          processR2Url: vi.fn((url: string, r2Bucket: string) => {
            // Extract R2 key from URL
            const urlObj = new URL(url);
            const path = urlObj.pathname;
            // Remove leading slash if present
            const r2Key = path.startsWith('/') ? path.substring(1) : path;
            
            return {
              r2Key,
              bucketName: r2Bucket,
              transformedUrl: `/cdn-cgi/image/width=800,quality=80/${r2Key}`
            };
          }),
          processUrl: vi.fn((url: string) => ({ 
            sourceUrl: url, 
            transformedUrl: url,
            options: {} 
          }))
        };
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger']
    });
    
    // 4. Register R2 integration service
    registry.register('IR2IntegrationService', {
      factory: (deps) => {
        const logger = deps.ILogger;
        const configManager = deps.IConfigManager;
        const urlTransformUtils = deps.IUrlTransformUtils;
        const config = configManager.getConfig();
        
        return {
          getR2Object: async (key: string, env: Record<string, unknown>): Promise<MockR2Object | null> => {
            const bucketName = config.r2?.binding_name || 'IMAGES_BUCKET';
            const bucket = env[bucketName] as unknown as MockR2Bucket;
            if (!bucket) return null;
            return bucket.get(key);
          },
          transformR2Url: (url: string): string => {
            const bucketName = config.r2?.binding_name || 'IMAGES_BUCKET';
            const result = urlTransformUtils.processR2Url(url, bucketName);
            return result.transformedUrl;
          }
        };
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger', 'IConfigManager', 'IUrlTransformUtils']
    });

    // Act
    const r2Service = registry.resolve<{
      getR2Object: (key: string, env: Record<string, unknown>) => Promise<MockR2Object | null>;
      transformR2Url: (url: string) => string;
    }>('IR2IntegrationService');
    
    // Assert
    expect(r2Service).toBeDefined();
    
    // Test R2 object retrieval
    return r2Service.getR2Object('test.jpg', mockEnv).then(object => {
      expect(object).toBeDefined();
      expect(object?.httpMetadata.contentType).toBe('image/jpeg');
      
      // Test URL transformation
      const transformedUrl = r2Service.transformR2Url('https://example.com/test.jpg');
      expect(transformedUrl).toBe('/cdn-cgi/image/width=800,quality=80/test.jpg');
    });
  });

  it('should maintain correct lifecycle when service registration changes', () => {
    // Arrange
    registry.register('DynamicService', {
      factory: () => ({
        value: 'singleton'
      }),
      lifecycle: 'singleton'
    });
    
    const instance1 = registry.resolve<{value: string}>('DynamicService');
    
    // Act - Change the registration to transient
    registry.register('DynamicService', {
      factory: () => ({
        value: 'transient'
      }),
      lifecycle: 'transient'
    });
    
    const instance2 = registry.resolve<{value: string}>('DynamicService');
    const instance3 = registry.resolve<{value: string}>('DynamicService');
    
    // Assert
    expect(instance1.value).toBe('singleton');
    expect(instance2.value).toBe('transient');
    expect(instance3.value).toBe('transient');
    expect(instance2).not.toBe(instance3); // Should be different instances for transient
  });
});