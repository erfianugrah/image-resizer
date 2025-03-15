/**
 * Utility functions for logging
 */

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
type LogData = Record<
  string,
  string | number | boolean | null | undefined | Array<unknown> | Record<string, unknown>
>;

/**
 * Log an error message
 * @param module Module name for context
 * @param message Error message
 * @param data Additional data
 */
export function error(module: string, message: string, data?: LogData): void {
  log('ERROR', module, message, data);
}

/**
 * Log a warning message
 * @param module Module name for context
 * @param message Warning message
 * @param data Additional data
 */
export function warn(module: string, message: string, data?: LogData): void {
  log('WARN', module, message, data);
}

/**
 * Log an info message
 * @param module Module name for context
 * @param message Info message
 * @param data Additional data
 */
export function info(module: string, message: string, data?: LogData): void {
  log('INFO', module, message, data);
}

/**
 * Log a debug message
 * @param module Module name for context
 * @param message Debug message
 * @param data Additional data
 */
export function debug(module: string, message: string, data?: LogData): void {
  log('DEBUG', module, message, data);
}

/**
 * Log a trace message
 * @param module Module name for context
 * @param message Trace message
 * @param data Additional data
 */
export function trace(module: string, message: string, data?: LogData): void {
  log('TRACE', module, message, data);
}

/**
 * Log a request
 * @param module Module name for context
 * @param request Request to log
 */
export function logRequest(module: string, request: Request): void {
  const url = new URL(request.url);

  debug(module, `${request.method} ${url.pathname}`, {
    search: url.search,
    headers: {
      'user-agent': request.headers.get('user-agent'),
      accept: request.headers.get('accept'),
      'cf-device-type': request.headers.get('cf-device-type'),
    },
  });
}

/**
 * Internal function to log messages at a specific level
 * @param level Log level
 * @param module Module name for context
 * @param message Log message
 * @param data Additional data
 */
function log(level: LogLevel, module: string, message: string, data?: LogData): void {
  const timestamp = new Date().toISOString();

  // In production, we'll want to omit DEBUG and TRACE logs
  // This can be controlled by the environment config
  if (level === 'DEBUG' || level === 'TRACE') {
    // Check if we should show debug logs - for now always show them
  }

  const formattedMessage = `[${timestamp}] [${level}] [${module}] ${message}`;

  if (data) {
    console.log(formattedMessage, data);
  } else {
    console.log(formattedMessage);
  }
}
