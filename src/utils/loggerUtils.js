/**
 * Logger utility for consistent logging throughout the application
 * Provides structured logging with configurable log levels
 */

// Log levels in order of severity (highest to lowest)
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

// Map string log levels to numeric values
export const LOG_LEVEL_MAP = {
  "ERROR": LOG_LEVELS.ERROR,
  "WARN": LOG_LEVELS.WARN,
  "INFO": LOG_LEVELS.INFO,
  "DEBUG": LOG_LEVELS.DEBUG,
  "TRACE": LOG_LEVELS.TRACE,
};

// Default config - can be overridden at runtime
const defaultConfig = {
  logLevel: LOG_LEVELS.INFO,
  includeTimestamp: true,
  enableStructuredLogs: true,
  enableConsoleLogs: true,
};

let loggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 * @param {Object} config - Logger configuration
 */
export function configureLogger(config = {}) {
  loggerConfig = { ...defaultConfig, ...config };
}

/**
 * Set the active log level
 * @param {number|string} level - Log level from LOG_LEVELS or string name
 */
export function setLogLevel(level) {
  if (typeof level === "string") {
    const numericLevel = LOG_LEVEL_MAP[level.toUpperCase()];
    if (numericLevel !== undefined) {
      loggerConfig.logLevel = numericLevel;
      return;
    }
  } else if (Object.values(LOG_LEVELS).includes(level)) {
    loggerConfig.logLevel = level;
    return;
  }

  // Use warn when possible to avoid recursive issues
  if (loggerConfig.enableConsoleLogs) {
    console.warn(
      `Invalid log level: ${level}. Using default: ${loggerConfig.logLevel}`,
    );
  }
}

/**
 * Parse log level from string and return the numeric value
 * @param {string} levelString - Log level string
 * @returns {number|null} - Numeric log level or null if invalid
 */
export function parseLogLevel(levelString) {
  if (!levelString) return null;

  const upperLevel = levelString.toUpperCase();
  return LOG_LEVEL_MAP[upperLevel] !== undefined
    ? LOG_LEVEL_MAP[upperLevel]
    : null;
}

/**
 * Check if a log level is enabled
 * @param {number|string} level - Log level to check
 * @returns {boolean} - Whether the level is enabled
 */
export function isLevelEnabled(level) {
  const numericLevel = typeof level === "string"
    ? LOG_LEVEL_MAP[level.toUpperCase()]
    : level;

  return numericLevel !== undefined && numericLevel <= loggerConfig.logLevel;
}

/**
 * Get current logger configuration
 * @returns {Object} - Current logger configuration
 */
export function getLoggerConfig() {
  return { ...loggerConfig };
}

/**
 * Core logging function
 * @param {number} level - Log level from LOG_LEVELS
 * @param {string} category - Logging category/tag
 * @param {string} message - Log message
 * @param {Object} data - Additional data to log
 * @returns {Object} - The logged data object
 */
function logMessage(level, category, message, data = {}) {
  // Skip if this level is not enabled
  if (level > loggerConfig.logLevel) {
    return null;
  }

  // Get level name for better readability
  const levelName =
    Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === level) ||
    "UNKNOWN";

  // Build structured log object
  const logData = {
    level: levelName,
    category,
    message,
    ...(Object.keys(data).length > 0 ? { data } : {}),
  };

  // Add timestamp if enabled
  if (loggerConfig.includeTimestamp) {
    logData.timestamp = new Date().toISOString();
  }

  // Output to console if enabled
  if (loggerConfig.enableConsoleLogs) {
    const consoleMethod = level === LOG_LEVELS.ERROR
      ? "error"
      : level === LOG_LEVELS.WARN
      ? "warn"
      : "log";

    if (loggerConfig.enableStructuredLogs) {
      console[consoleMethod](
        `[${levelName}][${category}] ${message}`,
        Object.keys(data).length > 0 ? data : "",
      );
    } else {
      console[consoleMethod](`[${levelName}][${category}] ${message}`);
    }
  }

  return logData;
}

// Convenience methods for each log level
export function error(category, message, data = {}) {
  return logMessage(LOG_LEVELS.ERROR, category, message, data);
}

export function warn(category, message, data = {}) {
  return logMessage(LOG_LEVELS.WARN, category, message, data);
}

export function info(category, message, data = {}) {
  return logMessage(LOG_LEVELS.INFO, category, message, data);
}

export function debug(category, message, data = {}) {
  return logMessage(LOG_LEVELS.DEBUG, category, message, data);
}

export function trace(category, message, data = {}) {
  return logMessage(LOG_LEVELS.TRACE, category, message, data);
}

/**
 * Log request details at DEBUG level
 * @param {string} category - Log category
 * @param {Request} request - The request to log
 */
export function logRequest(category, request) {
  if (LOG_LEVELS.DEBUG > loggerConfig.logLevel) return;

  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  debug(category, `Request: ${request.method} ${url.pathname}`, {
    url: url.toString(),
    params: Object.fromEntries(url.searchParams),
    headers: headers,
  });
}

/**
 * Log response details at DEBUG level
 * @param {string} category - Log category
 * @param {Response} response - The response to log
 */
export function logResponse(category, response) {
  if (LOG_LEVELS.DEBUG > loggerConfig.logLevel) return;

  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  debug(category, `Response: ${response.status} ${response.statusText}`, {
    headers: headers,
  });
}
