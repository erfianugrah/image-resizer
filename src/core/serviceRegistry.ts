/**
 * ServiceRegistry implementation
 * Central dependency injection container that manages service lifecycle and resolution
 */
import {
  IServiceRegistry,
  ServiceRegistration,
  ServiceRegistryDependencies,
} from '../types/core/serviceRegistry';
import { debug, error } from '../utils/loggerUtils';

// Global registry instance for application-wide access
let globalRegistryInstance: IServiceRegistry | null = null;

/**
 * Create a new ServiceRegistry instance
 * @param dependencies - Dependencies for the service registry
 * @returns A ServiceRegistry instance
 */
export function createServiceRegistry(
  _dependencies?: ServiceRegistryDependencies
): IServiceRegistry {
  const registry = new ServiceRegistryImpl();

  // Store the registry globally so it can be accessed from getInstance
  globalRegistryInstance = registry;

  return registry;
}

/**
 * Get the global registry instance
 * This is a helper for ensuring consistent registry usage
 * @returns The global registry instance or null if not initialized
 */
export function getGlobalRegistry(): IServiceRegistry | null {
  return globalRegistryInstance;
}

/**
 * Private implementation of the ServiceRegistry interface
 */
class ServiceRegistryImpl implements IServiceRegistry {
  private registrations: Map<string, ServiceRegistration<unknown>> = new Map();
  private singletonInstances: Map<string, unknown> = new Map();
  private scopedInstances: Map<string, Map<string, unknown>> = new Map();

  /**
   * Register a service with the registry
   * @param serviceId - Unique identifier for the service
   * @param registration - Service registration configuration
   */
  public register<T>(serviceId: string, registration: ServiceRegistration<T>): void {
    if (this.registrations.has(serviceId)) {
      debug('ServiceRegistry', `Overriding existing registration for ${serviceId}`);
    }

    this.registrations.set(serviceId, registration as ServiceRegistration<unknown>);

    // Clear singleton instance if it exists
    if (this.singletonInstances.has(serviceId)) {
      this.singletonInstances.delete(serviceId);
    }

    debug(
      'ServiceRegistry',
      `Registered service ${serviceId} with lifecycle ${registration.lifecycle}`
    );
  }

  /**
   * Resolve a service from the registry
   * @param serviceId - Unique identifier for the service
   * @param scope - Optional request scope for scoped services
   * @returns The requested service instance
   * @throws Error if service is not registered
   */
  public resolve<T>(serviceId: string, scope?: string): T {
    // Check if the service is registered
    if (!this.registrations.has(serviceId)) {
      const errorMsg = `Service ${serviceId} is not registered`;
      error('ServiceRegistry', errorMsg);
      throw new Error(errorMsg);
    }

    const registration = this.registrations.get(serviceId)! as ServiceRegistration<T>;

    // Handle based on lifecycle
    switch (registration.lifecycle) {
      case 'singleton':
        return this.resolveSingleton<T>(serviceId, registration);
      case 'scoped':
        if (!scope) {
          const errorMsg = `Scope is required for scoped service ${serviceId}`;
          error('ServiceRegistry', errorMsg);
          throw new Error(errorMsg);
        }
        return this.resolveScoped<T>(serviceId, registration, scope);
      case 'transient':
        return this.resolveTransient<T>(serviceId, registration);
      default: {
        const errorMsg = `Unknown lifecycle ${registration.lifecycle} for service ${serviceId}`;
        error('ServiceRegistry', errorMsg);
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Create a new scope for request-scoped services
   * @returns A unique scope identifier
   */
  public createScope(): string {
    const scope = `scope_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.scopedInstances.set(scope, new Map());
    return scope;
  }

  /**
   * Dispose of a scope and its services
   * @param scope - The scope identifier to dispose
   */
  public disposeScope(scope: string): void {
    if (this.scopedInstances.has(scope)) {
      debug('ServiceRegistry', `Disposing scope ${scope}`);
      this.scopedInstances.delete(scope);
    }
  }

  /**
   * Check if a service is registered
   * @param serviceId - Unique identifier for the service
   * @returns Boolean indicating if the service is registered
   */
  public isRegistered(serviceId: string): boolean {
    return this.registrations.has(serviceId);
  }

  /**
   * Resolve dependencies for a service
   * @param dependencies - List of dependency service IDs
   * @param scope - Optional request scope
   * @returns Object with resolved dependencies
   */
  private resolveDependencies(
    dependencies: string[] = [],
    scope?: string
  ): Record<string, unknown> {
    const resolvedDeps: Record<string, unknown> = {};

    for (const depId of dependencies) {
      resolvedDeps[depId] = this.resolve(depId, scope);
    }

    return resolvedDeps;
  }

  /**
   * Resolve a singleton service
   * @param serviceId - Service identifier
   * @param registration - Service registration
   * @returns Service instance
   */
  private resolveSingleton<T>(serviceId: string, registration: ServiceRegistration<T>): T {
    // Check if we already have an instance
    if (this.singletonInstances.has(serviceId)) {
      return this.singletonInstances.get(serviceId) as T;
    }

    // Create a new instance
    const deps = this.resolveDependencies(registration.dependencies);
    const instance = registration.factory(deps as Record<string, unknown>);

    // Store for future use
    this.singletonInstances.set(serviceId, instance);
    return instance;
  }

  /**
   * Resolve a scoped service
   * @param serviceId - Service identifier
   * @param registration - Service registration
   * @param scope - Request scope
   * @returns Service instance
   */
  private resolveScoped<T>(
    serviceId: string,
    registration: ServiceRegistration<T>,
    scope: string
  ): T {
    // Ensure scope exists
    if (!this.scopedInstances.has(scope)) {
      this.scopedInstances.set(scope, new Map());
    }

    const scopeInstances = this.scopedInstances.get(scope)!;

    // Check if we already have an instance for this scope
    if (scopeInstances.has(serviceId)) {
      return scopeInstances.get(serviceId) as T;
    }

    // Create a new instance for this scope
    const deps = this.resolveDependencies(registration.dependencies, scope);
    const instance = registration.factory(deps as Record<string, unknown>);

    // Store for future use in this scope
    scopeInstances.set(serviceId, instance);
    return instance;
  }

  /**
   * Resolve a transient service
   * @param serviceId - Service identifier
   * @param registration - Service registration
   * @returns Service instance
   */
  private resolveTransient<T>(serviceId: string, registration: ServiceRegistration<T>): T {
    // Always create a new instance
    const deps = this.resolveDependencies(registration.dependencies);
    return registration.factory(deps as Record<string, unknown>);
  }
}

/**
 * Implements the ServiceRegistry interface for dependency injection
 * @deprecated Use createServiceRegistry() factory function instead
 */
export class ServiceRegistry implements IServiceRegistry {
  private static instance: ServiceRegistry;
  private serviceRegistry: IServiceRegistry;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Use the existing global registry if available, otherwise create a new one
    const existingRegistry = getGlobalRegistry();
    this.serviceRegistry = existingRegistry || createServiceRegistry();
  }

  /**
   * Get the singleton instance of the ServiceRegistry
   * @returns ServiceRegistry instance
   * @deprecated Use createServiceRegistry() factory function instead
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service with the registry
   * @param serviceId - Unique identifier for the service
   * @param registration - Service registration configuration
   */
  public register<T>(serviceId: string, registration: ServiceRegistration<T>): void {
    this.serviceRegistry.register(serviceId, registration);
  }

  /**
   * Resolve a service from the registry
   * @param serviceId - Unique identifier for the service
   * @param scope - Optional request scope for scoped services
   * @returns The requested service instance
   */
  public resolve<T>(serviceId: string, scope?: string): T {
    return this.serviceRegistry.resolve<T>(serviceId, scope);
  }

  /**
   * Create a new scope for request-scoped services
   * @returns A unique scope identifier
   */
  public createScope(): string {
    return this.serviceRegistry.createScope();
  }

  /**
   * Dispose of a scope and its services
   * @param scope - The scope identifier to dispose
   */
  public disposeScope(scope: string): void {
    this.serviceRegistry.disposeScope(scope);
  }

  /**
   * Check if a service is registered
   * @param serviceId - Unique identifier for the service
   * @returns Boolean indicating if the service is registered
   */
  public isRegistered(serviceId: string): boolean {
    return this.serviceRegistry.isRegistered(serviceId);
  }
}
