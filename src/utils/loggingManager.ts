/**
 * Centralized logging configuration manager
 * Provides a single source of truth for logging configuration
 */

export interface LoggingConfig {
  level: string;
  includeTimestamp: boolean;
  enableStructuredLogs: boolean;
  debugHeaders?: {
    enabled: boolean;
    prefix?: string;
    includeHeaders?: string[];
    specialHeaders?: Record<string, boolean>;
    allowedEnvironments?: string[];
    isVerbose?: boolean;
  };
}

let loggingConfig: LoggingConfig = {
  level: 'INFO',
  includeTimestamp: true,
  enableStructuredLogs: true,
  debugHeaders: {
    enabled: false
  }
};

/**
 * Initialize logging configuration from environment
 * @param env Environment variables
 */
export interface LoggingEnvironment {
  LOGGING_CONFIG?: string | Record<string, unknown>;
  DEBUG_HEADERS_CONFIG?: string | Record<string, unknown>;
  [key: string]: unknown;
}

export function initializeLogging(env: LoggingEnvironment): void {
  try {
    // Process LOGGING_CONFIG
    if (env.LOGGING_CONFIG) {
      const configStr =
        typeof env.LOGGING_CONFIG === 'string'
          ? env.LOGGING_CONFIG
          : JSON.stringify(env.LOGGING_CONFIG);

      const config = JSON.parse(configStr);

      loggingConfig = {
        ...loggingConfig,
        level: config.level || 'INFO',
        includeTimestamp: config.includeTimestamp !== false,
        enableStructuredLogs: config.enableStructuredLogs !== false,
      };
    }

    // Process DEBUG_HEADERS_CONFIG
    if (env.DEBUG_HEADERS_CONFIG) {
      const configStr =
        typeof env.DEBUG_HEADERS_CONFIG === 'string'
          ? env.DEBUG_HEADERS_CONFIG
          : JSON.stringify(env.DEBUG_HEADERS_CONFIG);

      const config = JSON.parse(configStr);

      loggingConfig.debugHeaders = {
        enabled: config.enabled !== false,
        prefix: config.prefix || 'debug-',
        includeHeaders: config.includeHeaders || [],
        specialHeaders: config.specialHeaders || {},
        allowedEnvironments: config.allowedEnvironments || [],
        isVerbose: config.isVerbose || false
      };
    }

    console.log(
      `Logging initialized. Level: ${loggingConfig.level}, Structured: ${loggingConfig.enableStructuredLogs}, Debug Headers: ${loggingConfig.debugHeaders?.enabled}`
    );
  } catch (err) {
    console.error('Error initializing logging', err);
  }
}

/**
 * Get current logging configuration
 * @returns Current logging configuration
 */
export function getLoggingConfig(): LoggingConfig {
  return { ...loggingConfig };
}

/**
 * Get current debug headers configuration
 * @returns Current debug headers configuration or null if disabled
 */
export function getDebugHeadersConfig(): LoggingConfig['debugHeaders'] | null {
  return loggingConfig.debugHeaders?.enabled 
    ? { ...loggingConfig.debugHeaders } 
    : null;
}

/**
 * Check if a specific log level is enabled
 * @param level Log level to check
 * @returns Whether the level is enabled
 */
export function isLevelEnabled(level: string): boolean {
  const levels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4,
  };

  const configLevel = levels[loggingConfig.level.toUpperCase() as keyof typeof levels] || 2;
  const checkLevel = levels[level.toUpperCase() as keyof typeof levels];

  if (checkLevel === undefined) {
    return false;
  }

  return checkLevel <= configLevel;
}

/**
 * Check if debug headers are enabled for a given environment
 * @param environment Current environment name
 * @returns Whether debug headers are enabled
 */
export function areDebugHeadersEnabled(environment?: string): boolean {
  const debugConfig = loggingConfig.debugHeaders;
  
  // If debug headers are not enabled at all, return false
  if (!debugConfig || !debugConfig.enabled) {
    return false;
  }
  
  // If no environment restrictions, return true
  if (!debugConfig.allowedEnvironments || debugConfig.allowedEnvironments.length === 0) {
    return true;
  }
  
  // If environment is specified, check if it's allowed
  if (environment && debugConfig.allowedEnvironments.includes(environment)) {
    return true;
  }
  
  return false;
}
