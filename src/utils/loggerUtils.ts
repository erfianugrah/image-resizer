/**
 * Utility functions for logging
 * Provides centralized logging with configurable debug headers
 */
import { isLevelEnabled, getLoggingConfig, areDebugHeadersEnabled, getDebugHeadersConfig } from './loggingManager';

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
export type LogData = Record<
  string,
  string | number | boolean | null | undefined | Array<unknown> | Record<string, unknown>
>;

import { DebugInfo, DiagnosticsInfo } from '../types/utils/debug';

// Re-export types for backward compatibility
export type { DebugInfo, DiagnosticsInfo };

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
 * Extract headers from a request for debugging
 * @param request - The request to extract headers from
 * @returns Object containing header values
 */
export function extractRequestHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};

  // Extract common headers for debugging
  const headersToExtract = [
    'user-agent',
    'accept',
    'referer',
    'sec-ch-viewport-width',
    'sec-ch-dpr',
    'width',
    'cf-device-type',
    'cf-ipcountry',
    'cf-ray',
    'save-data',
    'x-forwarded-for',
  ];

  for (const headerName of headersToExtract) {
    const value = request.headers.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  }

  return headers;
}

/**
 * Log response details
 * @param module Module name for context
 * @param response The response to log
 */
export function logResponse(module: string, response: Response): void {
  info(module, `Response: ${response.status} ${response.statusText}`, {
    contentType: response.headers.get('content-type'),
    contentLength: response.headers.get('content-length'),
    cacheControl: response.headers.get('cache-control'),
  });
}

/**
 * Check if debug is enabled based on config and request
 * @param request - Request to check
 * @param environment - Current environment
 * @returns Debug configuration info
 */
export function getDebugInfoFromRequest(request: Request, environment?: string): DebugInfo {
  // Get config from centralized manager first
  const configEnabled = areDebugHeadersEnabled(environment);
  const debugConfig = getDebugHeadersConfig();
  
  // Check for request header overrides - these can enable debugging by request
  // even when it's disabled in configuration
  const debugHeaderEnabled = request.headers.get('x-debug') === 'true';
  const debugVerboseEnabled = request.headers.get('x-debug-verbose') === 'true'; 
  
  // Final enabled state: either config enables it OR request headers override to enable
  const isEnabled = configEnabled || debugHeaderEnabled || debugVerboseEnabled;
  
  // Verbosity level: request headers take precedence over config
  const isVerbose = debugVerboseEnabled || (debugConfig?.isVerbose || false);
  
  // Return consistent debug info based on configuration and request headers
  return {
    isEnabled,
    isVerbose,
    includePerformance: true,
    prefix: debugConfig?.prefix || 'debug-',
    includeHeaders: debugConfig?.includeHeaders || [],
    specialHeaders: debugConfig?.specialHeaders || {}
  };
}

/**
 * Adds debug headers to a response based on diagnostic information
 * Respects the wrangler.jsonc configuration and request override
 * @param response - The original response
 * @param debugInfo - Debug settings
 * @param diagnosticsInfo - Diagnostic information
 * @returns Response with debug headers
 */
export function addDebugHeaders(
  response: Response,
  debugInfo: DebugInfo,
  diagnosticsInfo: DiagnosticsInfo
): Response {
  try {
    // If debug is not enabled by config or request headers, return the original response
    if (!debugInfo.isEnabled) {
      return response;
    }

    // Strictly use the config with no special case for environment
    // The isEnabled flag on debugInfo already incorporates environment restrictions

    // Clone the response to make it mutable
    const enhancedResponse = new Response(response.body, response);
    const headers = enhancedResponse.headers;
    
    // Get prefix for debug headers
    const prefix = debugInfo.prefix || 'debug-';

    // Add performance timing if enabled
    if (debugInfo.includePerformance && diagnosticsInfo.processingTimeMs) {
      headers.set('x-processing-time', `${diagnosticsInfo.processingTimeMs}ms`);
    }

    // Get the list of headers to include
    const includeHeaders = new Set(debugInfo.includeHeaders || []);
    
    // Add debug headers for specific diagnostic information
    // Only add if the header is included in the configuration
    if (diagnosticsInfo.transformParams && (includeHeaders.size === 0 || includeHeaders.has('ir'))) {
      headers.set(`${prefix}ir`, JSON.stringify(diagnosticsInfo.transformParams));
    }

    if (diagnosticsInfo.pathMatch && (includeHeaders.size === 0 || includeHeaders.has('path'))) {
      headers.set(`${prefix}path-match`, diagnosticsInfo.pathMatch);
    }

    // Special headers are separate and controlled by the special headers config
    const specialHeaders = debugInfo.specialHeaders || {};
    
    if (diagnosticsInfo.transformSource && 
        (specialHeaders['x-size-source'] || includeHeaders.has('transform-source'))) {
      headers.set('x-size-source', diagnosticsInfo.transformSource);
    }

    if (diagnosticsInfo.deviceType && (includeHeaders.size === 0 || includeHeaders.has('device'))) {
      headers.set(`${prefix}device-type`, diagnosticsInfo.deviceType);
    }

    if (diagnosticsInfo.clientHints !== undefined && 
        (includeHeaders.size === 0 || includeHeaders.has('client-hints'))) {
      headers.set(`${prefix}client-hints`, String(diagnosticsInfo.clientHints));
    }

    // Cache related headers
    if (includeHeaders.size === 0 || includeHeaders.has('cache')) {
      // Always set the cache method header for debugging
      // Use environment override for production
      if (diagnosticsInfo.cachingMethod) {
        const environment = (diagnosticsInfo.environment as string) || '';
        const cacheMethod = environment === 'production' ? 'cf' : diagnosticsInfo.cachingMethod;
        headers.set(`${prefix}cache-method`, cacheMethod);
      }

      if (diagnosticsInfo.cacheability !== undefined) {
        headers.set(`${prefix}cacheable`, String(diagnosticsInfo.cacheability));
      }

      if (diagnosticsInfo.cacheTtl !== undefined) {
        headers.set(`${prefix}cache-ttl`, String(diagnosticsInfo.cacheTtl));
      }
    }

    // Add mode info if available
    if (diagnosticsInfo.mode && (includeHeaders.size === 0 || includeHeaders.has('mode'))) {
      headers.set(
        `${prefix}mode`,
        JSON.stringify({
          mode: diagnosticsInfo.mode,
          ...(diagnosticsInfo.requestTransform || {}),
        })
      );
    }

    // Add responsive sizing info if special headers allow it
    if (diagnosticsInfo.responsiveSizing !== undefined && 
        (specialHeaders['x-responsive-sizing'] || includeHeaders.has('responsive-sizing'))) {
      headers.set('x-responsive-sizing', String(diagnosticsInfo.responsiveSizing));
    }

    // Add actual width if special headers allow it
    if (diagnosticsInfo.actualWidth && 
        (specialHeaders['x-actual-width'] || includeHeaders.has('actual-width'))) {
      headers.set('x-actual-width', String(diagnosticsInfo.actualWidth));
    }

    // Add processing mode if special headers allow it
    if (diagnosticsInfo.processingMode && 
        (specialHeaders['x-processing-mode'] || includeHeaders.has('processing-mode'))) {
      headers.set('x-processing-mode', String(diagnosticsInfo.processingMode));
    }

    // Add verbose debug information if enabled
    if (debugInfo.isVerbose) {
      // Add browser capabilities if available
      if (diagnosticsInfo.browserCapabilities) {
        headers.set(`${prefix}browser`, JSON.stringify(diagnosticsInfo.browserCapabilities));
      }

      // Add network quality info if available
      if (diagnosticsInfo.networkQuality) {
        headers.set(`${prefix}network`, diagnosticsInfo.networkQuality);
      }

      // Add errors if any
      if (diagnosticsInfo.errors && diagnosticsInfo.errors.length > 0) {
        headers.set(`${prefix}errors`, JSON.stringify(diagnosticsInfo.errors));
      }

      // Add warnings if any
      if (diagnosticsInfo.warnings && diagnosticsInfo.warnings.length > 0) {
        headers.set(`${prefix}warnings`, JSON.stringify(diagnosticsInfo.warnings));
      }
      
      // Add strategy information if available (from enhanced debug)
      if (diagnosticsInfo.attemptedStrategies) {
        headers.set(`${prefix}strategy-attempts`, 
          Array.isArray(diagnosticsInfo.attemptedStrategies) 
            ? diagnosticsInfo.attemptedStrategies.join(',')
            : String(diagnosticsInfo.attemptedStrategies));
      }
      
      if (diagnosticsInfo.selectedStrategy) {
        headers.set(`${prefix}strategy-selected`, String(diagnosticsInfo.selectedStrategy));
      }
      
      if (diagnosticsInfo.domainType) {
        headers.set(`${prefix}domain-type`, String(diagnosticsInfo.domainType));
      }
      
      if (diagnosticsInfo.environmentType) {
        headers.set(`${prefix}environment-type`, String(diagnosticsInfo.environmentType));
      }
    }

    debug('DebugHeaders', 'Added debug headers', {
      headers: [...headers.entries()].filter(
        ([key]) => key.startsWith(prefix) || key.startsWith('x-')
      ),
    });

    return enhancedResponse;
  } catch (err) {
    // On error, return the original response
    return response;
  }
}

/**
 * Creates an HTML debug report from diagnostics information
 * @param diagnosticsInfo - Diagnostic information
 * @returns HTML string with debug report
 */
export function createDebugReport(diagnosticsInfo: DiagnosticsInfo): string {
  const now = new Date().toISOString();
  const title = 'Image Resizer Debug Report';

  // Process diagnostic information for the report
  const sections = [];

  // Basic information
  sections.push(`
    <section>
      <h2>Basic Information</h2>
      <table>
        <tr><th>Generated</th><td>${now}</td></tr>
        <tr><th>Original URL</th><td>${diagnosticsInfo.originalUrl || 'Unknown'}</td></tr>
        <tr><th>Path Match</th><td>${diagnosticsInfo.pathMatch || 'None'}</td></tr>
        <tr><th>Processing Time</th><td>${diagnosticsInfo.processingTimeMs || 0}ms</td></tr>
        <tr><th>Transform Source</th><td>${diagnosticsInfo.transformSource || 'Unknown'}</td></tr>
      </table>
    </section>
  `);

  // Transformation parameters
  if (diagnosticsInfo.transformParams) {
    sections.push(`
      <section>
        <h2>Transformation Parameters</h2>
        <pre>${JSON.stringify(diagnosticsInfo.transformParams, null, 2)}</pre>
      </section>
    `);
  }

  // Client information
  const clientInfo = [];
  if (diagnosticsInfo.deviceType)
    clientInfo.push(`<tr><th>Device Type</th><td>${diagnosticsInfo.deviceType}</td></tr>`);
  if (diagnosticsInfo.clientHints !== undefined)
    clientInfo.push(`<tr><th>Client Hints</th><td>${diagnosticsInfo.clientHints}</td></tr>`);
  if (diagnosticsInfo.browserCapabilities)
    clientInfo.push(
      `<tr><th>Browser Capabilities</th><td><pre>${JSON.stringify(diagnosticsInfo.browserCapabilities, null, 2)}</pre></td></tr>`
    );
  if (diagnosticsInfo.networkQuality)
    clientInfo.push(`<tr><th>Network Quality</th><td>${diagnosticsInfo.networkQuality}</td></tr>`);

  if (clientInfo.length > 0) {
    sections.push(`
      <section>
        <h2>Client Information</h2>
        <table>
          ${clientInfo.join('')}
        </table>
      </section>
    `);
  }

  // Cache information
  const cacheInfo = [];
  if (diagnosticsInfo.cacheability !== undefined)
    cacheInfo.push(`<tr><th>Cacheable</th><td>${diagnosticsInfo.cacheability}</td></tr>`);
  if (diagnosticsInfo.cacheTtl !== undefined)
    cacheInfo.push(`<tr><th>Cache TTL</th><td>${diagnosticsInfo.cacheTtl}s</td></tr>`);
  if (diagnosticsInfo.cachingMethod)
    cacheInfo.push(`<tr><th>Caching Method</th><td>${diagnosticsInfo.cachingMethod}</td></tr>`);

  if (cacheInfo.length > 0) {
    sections.push(`
      <section>
        <h2>Cache Information</h2>
        <table>
          ${cacheInfo.join('')}
        </table>
      </section>
    `);
  }

  // Transformation strategy information (from enhanced debug)
  const strategyInfo = [];
  if (diagnosticsInfo.selectedStrategy)
    strategyInfo.push(`<tr><th>Selected Strategy</th><td>${diagnosticsInfo.selectedStrategy}</td></tr>`);
  if (diagnosticsInfo.attemptedStrategies)
    strategyInfo.push(`<tr><th>Attempted Strategies</th><td>${Array.isArray(diagnosticsInfo.attemptedStrategies) 
      ? diagnosticsInfo.attemptedStrategies.join(', ') 
      : diagnosticsInfo.attemptedStrategies}</td></tr>`);
  if (diagnosticsInfo.domainType)
    strategyInfo.push(`<tr><th>Domain Type</th><td>${diagnosticsInfo.domainType}</td></tr>`);
  if (diagnosticsInfo.environmentType)
    strategyInfo.push(`<tr><th>Environment</th><td>${diagnosticsInfo.environmentType}</td></tr>`);
  
  if (strategyInfo.length > 0) {
    sections.push(`
      <section>
        <h2>Transformation Strategy</h2>
        <table>
          ${strategyInfo.join('')}
        </table>
      </section>
    `);
  }

  // Request headers
  if (diagnosticsInfo.requestHeaders) {
    const headerRows = Object.entries(diagnosticsInfo.requestHeaders)
      .map(([key, value]) => `<tr><th>${key}</th><td>${value}</td></tr>`)
      .join('');

    sections.push(`
      <section>
        <h2>Request Headers</h2>
        <table>
          ${headerRows}
        </table>
      </section>
    `);
  }

  // Errors and warnings
  const issues = [];
  if (diagnosticsInfo.errors && diagnosticsInfo.errors.length > 0) {
    const errorItems = diagnosticsInfo.errors
      .map((error) => `<li class="error">${error}</li>`)
      .join('');
    issues.push(`
      <div class="issues-group">
        <h3>Errors</h3>
        <ul>${errorItems}</ul>
      </div>
    `);
  }

  if (diagnosticsInfo.warnings && diagnosticsInfo.warnings.length > 0) {
    const warningItems = diagnosticsInfo.warnings
      .map((warning) => `<li class="warning">${warning}</li>`)
      .join('');
    issues.push(`
      <div class="issues-group">
        <h3>Warnings</h3>
        <ul>${warningItems}</ul>
      </div>
    `);
  }

  if (issues.length > 0) {
    sections.push(`
      <section>
        <h2>Issues</h2>
        ${issues.join('')}
      </section>
    `);
  }

  // Build the complete HTML document
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
      }
      h1 {
        color: #2c3e50;
        border-bottom: 1px solid #eee;
        padding-bottom: 0.5rem;
      }
      section {
        margin: 2rem 0;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      h2 {
        color: #3498db;
        margin-top: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 0.5rem;
        border-bottom: 1px solid #ddd;
      }
      th {
        background-color: #f1f1f1;
        width: 30%;
      }
      pre {
        background-color: #f1f1f1;
        padding: 1rem;
        overflow: auto;
        border-radius: 4px;
        max-height: 300px;
      }
      .error {
        color: #e74c3c;
      }
      .warning {
        color: #e67e22;
      }
      .issues-group {
        margin-bottom: 1rem;
      }
      h3 {
        color: #34495e;
        margin-bottom: 0.5rem;
      }
      footer {
        text-align: center;
        font-size: 0.9rem;
        color: #7f8c8d;
        margin-top: 2rem;
      }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    
    ${sections.join('')}
    
    <footer>Generated by Image Resizer Debug Service</footer>
  </body>
  </html>
  `;
}

/**
 * Internal function to log messages at a specific level
 * @param level Log level
 * @param module Module name for context
 * @param message Log message
 * @param data Additional data
 */
function log(level: LogLevel, module: string, message: string, data?: LogData): void {
  // Check if we should show this log based on configured level
  if (!isLevelEnabled(level)) {
    return;
  }

  const config = getLoggingConfig();
  const timestamp = config.includeTimestamp ? new Date().toISOString() : '';
  
  let formattedMessage = '';
  
  if (timestamp) {
    formattedMessage += `[${timestamp}] `;
  }
  
  formattedMessage += `[${level}] [${module}] ${message}`;

  if (data && config.enableStructuredLogs) {
    console.log(formattedMessage, data);
  } else {
    console.log(formattedMessage);
  }
}
