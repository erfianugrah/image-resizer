/**
 * Centralized logging interfaces
 * Standardizes logging across services
 */

/**
 * Standard logger interface
 */
export interface ILogger {
  /**
   * Log debug information
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  debug(module: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log information
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  info(module: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log warning
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  warn(module: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log error
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  error(module: string, message: string, data?: Record<string, unknown>): void;

  /**
   * Log a request
   * @param module - Module name
   * @param request - Request object
   */
  logRequest(module: string, request: Request): void;

  /**
   * Log a response
   * @param module - Module name
   * @param response - Response object
   */
  logResponse(module: string, response: Response): void;
}

/**
 * Minimal logger interface for service dependencies
 * Provides core logging functionality in a simpler format
 * with fixed module name for easy integration
 */
export interface IMinimalLogger {
  /**
   * Log debug information
   * @param message - Log message
   * @param data - Optional data object
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log information (if available, falls back to debug if not)
   * @param message - Log message
   * @param data - Optional data object
   */
  info?(message: string, data?: Record<string, unknown>): void;

  /**
   * Log warning
   * @param message - Log message
   * @param data - Optional data object
   */
  warn?(message: string, data?: Record<string, unknown>): void;

  /**
   * Log error
   * @param message - Log message
   * @param data - Optional data object
   */
  error(message: string, data?: Record<string, unknown>): void;

  /**
   * Log response (optional)
   * @param response - Response object
   */
  logResponse?(response: Response): void;
}

/**
 * Logger factory interface
 */
export interface ILoggerFactory {
  /**
   * Create a logger instance
   * @param name - Logger name
   * @returns Logger instance
   */
  createLogger(name: string): ILogger;

  /**
   * Create a minimal logger for a service
   * @param module - Module name to be used for all logs
   * @returns Minimal logger instance
   */
  createMinimalLogger(module: string): IMinimalLogger;
}
