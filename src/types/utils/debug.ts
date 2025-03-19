/**
 * Centralized debug and diagnostic information interfaces
 */

/**
 * Debug information settings
 * Used to control debug header output and verbosity
 */
export interface DebugInfo {
  isEnabled: boolean;
  isVerbose?: boolean;
  includeHeaders?: string[];
  includePerformance?: boolean;
  deploymentMode?: string;
  isRemoteFetch?: boolean;
  isR2Fetch?: boolean;
  r2Key?: string;
  r2Bucket?: unknown;
  // New fields to support centralized configuration
  prefix?: string;
  specialHeaders?: Record<string, boolean>;
}

/**
 * Diagnostic information for tracking and debugging
 */
export interface DiagnosticsInfo {
  // Basic information
  originalUrl?: string;
  transformParams?: Record<string, string | number | boolean | null | undefined>;
  pathMatch?: string;
  errors?: string[];
  warnings?: string[];
  
  // Client information
  clientHints?: boolean;
  deviceType?: string;
  videoId?: string;
  browserCapabilities?: Record<string, string | number | boolean | undefined>;
  networkQuality?: string;
  
  // Cache information
  cacheability?: boolean;
  cacheTtl?: number;
  cachingMethod?: string;
  
  // Format and transformation info
  videoFormat?: string;
  estimatedBitrate?: number;
  processingTimeMs?: number;
  transformSource?: string;
  
  // Request information
  requestHeaders?: Record<string, string>;
  mode?: string;
  requestTransform?: Record<string, unknown>;
  responsiveSizing?: boolean;
  actualWidth?: number;
  processingMode?: string;
  
  // Environment information
  environment?: string;
  
  // Strategy information (from enhanced debug)
  attemptedStrategies?: string[] | string;
  selectedStrategy?: string;
  failedStrategies?: Record<string, string> | string[];
  domainType?: string;
  environmentType?: string;
  strategyPriorityOrder?: string[] | string;
  disabledStrategies?: string[] | string;
  enabledStrategies?: string[] | string;
  isWorkersDevDomain?: boolean;
  isCustomDomain?: boolean;
  
  // Allow for additional properties
  [key: string]: unknown;
}

/**
 * Interface for the debug service
 */
export interface IDebugService {
  /**
   * Extract headers from a request for debugging
   * @param request - The request to extract headers from
   * @returns Object containing header values
   */
  extractRequestHeaders(request: Request): Record<string, string>;

  /**
   * Adds debug headers to a response based on diagnostic information
   * @param response - The original response
   * @param debugInfo - Debug settings
   * @param diagnosticsInfo - Diagnostic information
   * @returns Response with debug headers
   */
  addDebugHeaders(
    response: Response,
    debugInfo: DebugInfo,
    diagnosticsInfo: DiagnosticsInfo
  ): Response;

  /**
   * Creates an HTML debug report from diagnostics information
   * @param diagnosticsInfo - Diagnostic information
   * @returns HTML string with debug report
   */
  createDebugReport(diagnosticsInfo: DiagnosticsInfo): string;
}

/**
 * Dependencies for the debug service
 */
export interface DebugServiceDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
