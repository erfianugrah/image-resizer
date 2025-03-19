/**
 * Enhanced Debug Headers Utility
 * 
 * Provides specialized debug headers for strategy selection and transformation attempts
 * to help with diagnosing environment-specific behavior.
 * 
 * This module is integrated with the centralized logging configuration.
 */

import { DiagnosticsInfo, DebugInfo } from '../types/utils/debug';
import { IEnvironmentService } from '../types/services/environment';
import { getDebugHeadersConfig, areDebugHeadersEnabled } from './loggingManager';
import { debug } from './loggerUtils';

export interface StrategyDiagnostics {
  attemptedStrategies: string[];
  selectedStrategy?: string;
  failedStrategies?: Record<string, string>;
  domainType?: string;
  environmentType?: string;
  priorityOrder?: string[];
  disabledStrategies?: string[];
  enabledStrategies?: string[];
  isWorkersDevDomain?: boolean;
  isCustomDomain?: boolean;
}

/**
 * Check if debug is enabled and get debug info from request or config
 * @param request - The request to check for debug headers
 * @param environment - Current environment name
 * @returns Debug info configuration
 */
export function getEnhancedDebugInfo(request: Request, environment?: string): DebugInfo {
  // Check for debug override in request headers
  const debugHeaderEnabled = request.headers.get('x-debug') === 'true';
  const debugVerboseEnabled = request.headers.get('x-debug-verbose') === 'true';
  
  // Get config from centralized logging manager
  const configEnabled = areDebugHeadersEnabled(environment);
  const debugConfig = getDebugHeadersConfig();
  
  // Debug is enabled if either request header or config enables it
  const isEnabled = debugHeaderEnabled || debugVerboseEnabled || configEnabled;
  
  // Determine verbosity level - request headers take precedence
  const isVerbose = debugVerboseEnabled || (debugConfig?.isVerbose || false);
  
  // Use prefix from config or default
  const prefix = debugConfig?.prefix || 'debug-';
  
  // Create debug info object
  return {
    isEnabled,
    isVerbose,
    includePerformance: true,
    prefix,
    includeHeaders: debugConfig?.includeHeaders || [],
    specialHeaders: debugConfig?.specialHeaders || {},
    r2Key: request.url.split('/').pop() || ''
  };
}

/**
 * Add enhanced debug headers related to strategy selection and environments
 * Based on centralized configuration and request headers
 * @param response - The original response
 * @param debugInfo - Debug settings
 * @param strategyDiagnostics - Strategy diagnostic information
 * @param environmentService - Optional environment service for additional diagnostics
 * @returns Response with enhanced debug headers
 */
export function addEnhancedDebugHeaders(
  response: Response,
  debugInfo: DebugInfo,
  strategyDiagnostics: StrategyDiagnostics,
  environmentService?: IEnvironmentService
): Response {
  try {
    // If debug is not enabled, return the original response
    if (!debugInfo.isEnabled) {
      return response;
    }

    // Clone the response to make it mutable
    const enhancedResponse = new Response(response.body, response);
    const headers = enhancedResponse.headers;
    
    // Get prefix from debug info
    const prefix = debugInfo.prefix || 'debug-';

    debug('EnhancedDebug', 'Adding enhanced debug headers', {
      isEnabled: debugInfo.isEnabled,
      isVerbose: debugInfo.isVerbose,
      prefix,
      includeHeaders: debugInfo.includeHeaders
    });

    // Add strategy diagnostics
    if (strategyDiagnostics.attemptedStrategies && strategyDiagnostics.attemptedStrategies.length > 0) {
      headers.set(`${prefix}strategy-attempts`, strategyDiagnostics.attemptedStrategies.join(','));
    }

    if (strategyDiagnostics.selectedStrategy) {
      headers.set(`${prefix}strategy-selected`, strategyDiagnostics.selectedStrategy);
    }

    if (strategyDiagnostics.failedStrategies) {
      // Convert the error map to a string format: strategy1:error1;strategy2:error2
      const failuresStr = Object.entries(strategyDiagnostics.failedStrategies)
        .map(([strategy, error]) => `${strategy}:${error}`)
        .join(';');
      
      if (failuresStr) {
        headers.set(`${prefix}strategy-failures`, failuresStr);
      }
    }

    // Add environment and domain information
    if (strategyDiagnostics.domainType) {
      headers.set(`${prefix}domain-type`, strategyDiagnostics.domainType);
    }
    
    if (strategyDiagnostics.environmentType) {
      headers.set(`${prefix}environment`, strategyDiagnostics.environmentType);
    }
    
    // Add domain detection flags
    if (strategyDiagnostics.isWorkersDevDomain !== undefined) {
      headers.set(`${prefix}is-workers-dev`, String(strategyDiagnostics.isWorkersDevDomain));
    }
    
    if (strategyDiagnostics.isCustomDomain !== undefined) {
      headers.set(`${prefix}is-custom-domain`, String(strategyDiagnostics.isCustomDomain));
    }

    // Add strategy configuration info
    if (strategyDiagnostics.priorityOrder && strategyDiagnostics.priorityOrder.length > 0) {
      headers.set(`${prefix}strategy-order`, strategyDiagnostics.priorityOrder.join(','));
    }
    
    if (strategyDiagnostics.disabledStrategies && strategyDiagnostics.disabledStrategies.length > 0) {
      headers.set(`${prefix}disabled-strategies`, strategyDiagnostics.disabledStrategies.join(','));
    }
    
    if (strategyDiagnostics.enabledStrategies && strategyDiagnostics.enabledStrategies.length > 0) {
      headers.set(`${prefix}enabled-strategies`, strategyDiagnostics.enabledStrategies.join(','));
    }

    // If environment service is available, add additional diagnostics
    if (environmentService) {
      try {
        // Get the current URL from the response
        const url = response.url;
        
        // Add environment-specific diagnostics
        if (url) {
          const config = environmentService.getRouteConfigForUrl(url);
          if (config) {
            // Add route configuration as a debug header
            headers.set(`${prefix}route-config`, JSON.stringify({
              pattern: config.pattern,
              environment: config.environment,
              hasStrategies: !!config.strategies
            }));
            
            // Add strategy priority if available
            if (config.strategies?.priorityOrder) {
              headers.set(`${prefix}route-strategy-order`, config.strategies.priorityOrder.join(','));
            }
          }
        }
      } catch (err) {
        // Ignore errors from environment service
      }
    }

    // Log what we've added at debug level
    debug('EnhancedDebugHeaders', 'Added enhanced debug headers', {
      headerCount: [...headers.entries()].filter(([key]) => key.startsWith(prefix)).length,
      strategies: strategyDiagnostics.attemptedStrategies
    });

    return enhancedResponse;
  } catch (err) {
    // Log error but don't crash
    debug('EnhancedDebugHeaders', 'Error adding enhanced debug headers', {
      error: err instanceof Error ? err.message : String(err)
    });
    
    // On error, return the original response
    return response;
  }
}

/**
 * Updates diagnostic info with strategy-related information
 * @param diagnosticInfo - The existing diagnostic info to update
 * @param strategyDiagnostics - Strategy diagnostic information
 * @returns Updated diagnostic info
 */
export function updateDiagnosticsWithStrategyInfo(
  diagnosticInfo: DiagnosticsInfo,
  strategyDiagnostics: StrategyDiagnostics
): DiagnosticsInfo {
  return {
    ...diagnosticInfo,
    attemptedStrategies: strategyDiagnostics.attemptedStrategies,
    selectedStrategy: strategyDiagnostics.selectedStrategy,
    failedStrategies: strategyDiagnostics.failedStrategies,
    domainType: strategyDiagnostics.domainType,
    environmentType: strategyDiagnostics.environmentType,
    strategyPriorityOrder: strategyDiagnostics.priorityOrder,
    disabledStrategies: strategyDiagnostics.disabledStrategies,
    enabledStrategies: strategyDiagnostics.enabledStrategies,
    isWorkersDevDomain: strategyDiagnostics.isWorkersDevDomain,
    isCustomDomain: strategyDiagnostics.isCustomDomain
  };
}