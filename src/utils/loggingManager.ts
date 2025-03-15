/**
 * Centralized logging configuration manager
 */

interface LoggingConfig {
  level: string;
  includeTimestamp: boolean;
  enableStructuredLogs: boolean;
}

let loggingConfig: LoggingConfig = {
  level: 'INFO',
  includeTimestamp: true,
  enableStructuredLogs: true,
};

/**
 * Initialize logging configuration from environment
 * @param env Environment variables
 */
export interface LoggingEnvironment {
  LOGGING_CONFIG?: string | Record<string, unknown>;
  [key: string]: unknown;
}

export function initializeLogging(env: LoggingEnvironment): void {
  try {
    if (env.LOGGING_CONFIG) {
      const configStr =
        typeof env.LOGGING_CONFIG === 'string'
          ? env.LOGGING_CONFIG
          : JSON.stringify(env.LOGGING_CONFIG);

      const config = JSON.parse(configStr);

      loggingConfig = {
        level: config.level || 'INFO',
        includeTimestamp: config.includeTimestamp !== false,
        enableStructuredLogs: config.enableStructuredLogs !== false,
      };

      console.log(
        `Logging initialized. Level: ${loggingConfig.level}, Structured: ${loggingConfig.enableStructuredLogs}`
      );
    }
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

  const configLevel = levels[loggingConfig.level as keyof typeof levels] || 2;
  const checkLevel = levels[level as keyof typeof levels];

  if (checkLevel === undefined) {
    return false;
  }

  return checkLevel <= configLevel;
}
