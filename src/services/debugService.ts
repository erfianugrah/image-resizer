/**
 * Service for providing debugging capabilities for the image resizer
 * Handles debug headers, reports, and diagnostic information
 */
import { debug } from '../utils/loggerUtils';

// Debug information settings
export interface DebugInfo {
  isEnabled: boolean;
  isVerbose?: boolean;
  includeHeaders?: string[];
  includePerformance?: boolean;
}

// Diagnostic information type
export interface DiagnosticsInfo {
  originalUrl?: string;
  transformParams?: Record<string, string | number | boolean | null | undefined>;
  pathMatch?: string;
  errors?: string[];
  warnings?: string[];
  clientHints?: boolean;
  deviceType?: string;
  videoId?: string;
  browserCapabilities?: Record<string, string | number | boolean | undefined>;
  networkQuality?: string;
  cacheability?: boolean;
  cacheTtl?: number;
  videoFormat?: string;
  estimatedBitrate?: number;
  processingTimeMs?: number;
  transformSource?: string;
  requestHeaders?: Record<string, string>;
  cachingMethod?: string;
}

/**
 * Extract headers from a request for debugging
 *
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
 * Adds debug headers to a response based on diagnostic information
 *
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
    // If debug is not enabled, return the original response
    if (!debugInfo.isEnabled) {
      return response;
    }

    // Clone the response to make it mutable
    const enhancedResponse = new Response(response.body, response);

    // Add performance timing if enabled
    if (debugInfo.includePerformance && diagnosticsInfo.processingTimeMs) {
      enhancedResponse.headers.set('x-processing-time', `${diagnosticsInfo.processingTimeMs}ms`);
    }

    // Add debug headers for specific diagnostic information
    if (diagnosticsInfo.transformParams) {
      enhancedResponse.headers.set('debug-ir', JSON.stringify(diagnosticsInfo.transformParams));
    }

    if (diagnosticsInfo.pathMatch) {
      enhancedResponse.headers.set('debug-path-match', diagnosticsInfo.pathMatch);
    }

    if (diagnosticsInfo.transformSource) {
      enhancedResponse.headers.set('x-size-source', diagnosticsInfo.transformSource);
    }

    if (diagnosticsInfo.deviceType) {
      enhancedResponse.headers.set('debug-device-type', diagnosticsInfo.deviceType);
    }

    if (diagnosticsInfo.clientHints !== undefined) {
      enhancedResponse.headers.set('debug-client-hints', diagnosticsInfo.clientHints.toString());
    }

    if (diagnosticsInfo.cachingMethod) {
      enhancedResponse.headers.set('debug-cache-method', diagnosticsInfo.cachingMethod);
    }

    if (diagnosticsInfo.cacheability !== undefined) {
      enhancedResponse.headers.set('debug-cacheable', diagnosticsInfo.cacheability.toString());
    }

    if (diagnosticsInfo.cacheTtl !== undefined) {
      enhancedResponse.headers.set('debug-cache-ttl', diagnosticsInfo.cacheTtl.toString());
    }

    // Add verbose debug information if enabled
    if (debugInfo.isVerbose) {
      // Add browser capabilities if available
      if (diagnosticsInfo.browserCapabilities) {
        enhancedResponse.headers.set(
          'debug-browser',
          JSON.stringify(diagnosticsInfo.browserCapabilities)
        );
      }

      // Add network quality info if available
      if (diagnosticsInfo.networkQuality) {
        enhancedResponse.headers.set('debug-network', diagnosticsInfo.networkQuality);
      }

      // Add errors if any
      if (diagnosticsInfo.errors && diagnosticsInfo.errors.length > 0) {
        enhancedResponse.headers.set('debug-errors', JSON.stringify(diagnosticsInfo.errors));
      }

      // Add warnings if any
      if (diagnosticsInfo.warnings && diagnosticsInfo.warnings.length > 0) {
        enhancedResponse.headers.set('debug-warnings', JSON.stringify(diagnosticsInfo.warnings));
      }
    }

    debug('DebugService', 'Added debug headers', {
      headers: [...enhancedResponse.headers.entries()].filter(
        ([key]) => key.startsWith('debug-') || key.startsWith('x-')
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
 *
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
