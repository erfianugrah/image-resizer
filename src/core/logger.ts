/**
 * Logger implementation to support dependency injection
 * Adapts existing logging utilities to the ILogger interface
 */
import { ILogger, ILoggerFactory, IMinimalLogger } from '../types/core/logger';
import {
  debug as logDebug,
  info as logInfo,
  warn as logWarn,
  error as logError,
  logRequest as logReq,
  logResponse as logResp,
  LogData,
} from '../utils/loggerUtils';

/**
 * LoggerFactory dependencies interface
 */
export interface LoggerFactoryDependencies {
  // No dependencies for now, but we're keeping the interface for consistency
  // and to allow for future expansion
}

/**
 * Create a new minimal logger for a service with a fixed module name
 * @param logger - The parent logger to use
 * @param moduleName - The module name to log under
 * @returns A minimal logger instance with fixed module name
 */
export function createMinimalLoggerAdapter(logger: ILogger, moduleName: string): IMinimalLogger {
  return {
    debug: (message: string, data?: Record<string, unknown>): void => {
      logger.debug(moduleName, message, data);
    },

    info: (message: string, data?: Record<string, unknown>): void => {
      logger.info(moduleName, message, data);
    },

    warn: (message: string, data?: Record<string, unknown>): void => {
      logger.warn(moduleName, message, data);
    },

    error: (message: string, data?: Record<string, unknown>): void => {
      logger.error(moduleName, message, data);
    },

    logResponse: (response: Response): void => {
      logger.logResponse(moduleName, response);
    },
  };
}

/**
 * Create a new logger factory
 * @param dependencies - Optional dependencies for the logger factory
 * @returns A logger factory instance
 */
export function createLoggerFactory(_dependencies?: LoggerFactoryDependencies): ILoggerFactory {
  return {
    createLogger: (name: string): ILogger => {
      return createLogger(name);
    },

    createMinimalLogger: (moduleName: string): IMinimalLogger => {
      // Create a standard logger first and then adapt it to minimal interface
      const logger = createLogger('Service');
      return createMinimalLoggerAdapter(logger, moduleName);
    },
  };
}

/**
 * Create a new logger instance
 * @param name - Logger name
 * @returns Logger instance
 */
export function createLogger(name: string): ILogger {
  return new Logger(name);
}

/**
 * Logger implementation that uses the existing logger utilities
 */
export class Logger implements ILogger {
  private moduleName: string;

  /**
   * Create a new logger instance
   * @param moduleName - The module name to log under
   */
  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  /**
   * Log debug information
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  public debug(module: string, message: string, data?: Record<string, unknown>): void {
    logDebug(`${this.moduleName}.${module}`, message, data as LogData);
  }

  /**
   * Log information
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  public info(module: string, message: string, data?: Record<string, unknown>): void {
    logInfo(`${this.moduleName}.${module}`, message, data as LogData);
  }

  /**
   * Log warning
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  public warn(module: string, message: string, data?: Record<string, unknown>): void {
    logWarn(`${this.moduleName}.${module}`, message, data as LogData);
  }

  /**
   * Log error
   * @param module - Module name
   * @param message - Log message
   * @param data - Optional data object
   */
  public error(module: string, message: string, data?: Record<string, unknown>): void {
    logError(`${this.moduleName}.${module}`, message, data as LogData);
  }

  /**
   * Log a request
   * @param module - Module name
   * @param request - Request object
   */
  public logRequest(module: string, request: Request): void {
    logReq(`${this.moduleName}.${module}`, request);
  }

  /**
   * Log a response
   * @param module - Module name
   * @param response - Response object
   */
  public logResponse(module: string, response: Response): void {
    logResp(`${this.moduleName}.${module}`, response);
  }
}

/**
 * Factory for creating Logger instances
 * @deprecated Use the createLoggerFactory function instead
 */
export class LoggerFactory implements ILoggerFactory {
  private static instance: LoggerFactory;
  private loggerFactory: ILoggerFactory;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.loggerFactory = createLoggerFactory();
  }

  /**
   * Get the singleton instance of the LoggerFactory
   * @returns LoggerFactory instance
   * @deprecated Use the createLoggerFactory function instead
   */
  public static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Create a new logger instance
   * @param name - Logger name
   * @returns Logger instance
   */
  public createLogger(name: string): ILogger {
    return this.loggerFactory.createLogger(name);
  }

  /**
   * Create a minimal logger for a service
   * @param module - Module name to be used for all logs
   * @returns Minimal logger instance
   */
  public createMinimalLogger(module: string): IMinimalLogger {
    return this.loggerFactory.createMinimalLogger(module);
  }
}
