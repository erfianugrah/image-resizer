/**
 * Service Registry interfaces and types
 * These define the central dependency injection system that manages service creation and lifecycle
 */

/**
 * Parameters for service factories
 */
export interface ServiceParameters {
  [key: string]: any;
}

/**
 * Generic service factory type with optional parameters
 */
export type ServiceFactory<T> = (dependencies: any, parameters?: ServiceParameters) => T;

/**
 * Service lifecycle modes
 * - singleton: Service is created once and reused
 * - transient: Service is created new on each request
 * - scoped: Service is created once per request scope
 */
export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped';

/**
 * Service registration configuration
 */
export interface ServiceRegistration<T> {
  factory: ServiceFactory<T>;
  lifecycle: ServiceLifecycle;
  dependencies?: string[];
  parameters?: ServiceParameters;
}

/**
 * Interface for the ServiceRegistry
 * Provides a central location for registering and resolving service dependencies
 */
export interface IServiceRegistry {
  /**
   * Register a service with the registry
   * @param serviceId - Unique identifier for the service (typically interface name)
   * @param registration - Service registration configuration
   */
  register<T>(serviceId: string, registration: ServiceRegistration<T>): void;

  /**
   * Resolve a service from the registry
   * @param serviceId - Unique identifier for the service
   * @param scope - Optional request scope for scoped services
   * @param parameters - Optional parameters to pass to the service factory
   * @returns The requested service instance
   */
  resolve<T>(serviceId: string, scope?: string, parameters?: ServiceParameters): T;

  /**
   * Create a scope for request-scoped services
   * @returns A unique scope identifier
   */
  createScope(): string;

  /**
   * Dispose of a scope and its services
   * @param scope - The scope identifier to dispose
   */
  disposeScope(scope: string): void;

  /**
   * Check if a service is registered
   * @param serviceId - Unique identifier for the service
   * @returns Boolean indicating if the service is registered
   */
  isRegistered(serviceId: string): boolean;
}

/**
 * Dependencies for the ServiceRegistry factory
 */
export interface ServiceRegistryDependencies {
  // Currently no dependencies, but maintaining this interface
  // for consistency and future expansion
}
