/**
 * Debug headers utilities
 *
 * This file is deprecated. Use loggerUtils instead.
 * This file is maintained for backward compatibility only.
 */
import {
  DebugInfo as LoggerDebugInfo,
  DiagnosticsInfo,
  addDebugHeaders as loggerAddDebugHeaders,
} from './loggerUtils';

// Re-export DebugInfo for backward compatibility
export type DebugInfo = LoggerDebugInfo;

/**
 * @deprecated Use DiagnosticsInfo from loggerUtils instead
 */
export interface DebugOptions {
  irOptions?: Record<string, unknown>;
  cacheConfig?: Record<string, unknown>;
  mode?: string;
  requestTransform?: Record<string, unknown>;
  clientHints?: Record<string, unknown>;
  userAgent?: string;
  device?: Record<string, unknown>;
  sizeSource?: string;
  actualWidth?: number;
  processingMode?: string;
  responsiveSizing?: boolean;
  [key: string]: unknown;
}

/**
 * @deprecated Use addDebugHeaders from loggerUtils instead
 */
export function addDebugHeaders(
  response: Response,
  debugInfo: DebugInfo,
  options: DebugOptions
): Response {
  // Convert DebugOptions to DiagnosticsInfo
  const diagnosticsInfo: DiagnosticsInfo = {
    ...options,
    transformParams: options.irOptions as Record<
      string,
      string | number | boolean | null | undefined
    >,
    // Convert specific fields to the correct types
    clientHints:
      typeof options.clientHints === 'boolean'
        ? options.clientHints
        : options.clientHints
          ? true
          : undefined,
  };

  // Use the consolidated implementation from loggerUtils
  return loggerAddDebugHeaders(response, debugInfo, diagnosticsInfo);
}
