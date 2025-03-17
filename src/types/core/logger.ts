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
 * Logger factory interface
 */
export interface ILoggerFactory {
  /**
   * Create a logger instance
   * @param name - Logger name
   * @returns Logger instance
   */
  createLogger(name: string): ILogger;
}
