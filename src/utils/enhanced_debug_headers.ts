/**
 * Enhanced Debug Headers Utility
 * 
 * Provides specialized debug headers for strategy selection and transformation attempts
 * to help with diagnosing environment-specific behavior.
 */

import { DiagnosticsInfo, DebugInfo } from '../types/utils/debug';
import { IEnvironmentService } from '../types/services/environment';

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
 * Add enhanced debug headers related to strategy selection and environments
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

    // Add strategy diagnostics
    if (strategyDiagnostics.attemptedStrategies && strategyDiagnostics.attemptedStrategies.length > 0) {
      headers.set('x-debug-strategy-attempts', strategyDiagnostics.attemptedStrategies.join(','));
    }

    if (strategyDiagnostics.selectedStrategy) {
      headers.set('x-debug-strategy-selected', strategyDiagnostics.selectedStrategy);
    }

    if (strategyDiagnostics.failedStrategies) {
      // Convert the error map to a string format: strategy1:error1;strategy2:error2
      const failuresStr = Object.entries(strategyDiagnostics.failedStrategies)
        .map(([strategy, error]) => `${strategy}:${error}`)
        .join(';');
      
      if (failuresStr) {
        headers.set('x-debug-strategy-failures', failuresStr);
      }
    }

    // Add environment and domain information
    if (strategyDiagnostics.domainType) {
      headers.set('x-debug-domain-type', strategyDiagnostics.domainType);
    }
    
    if (strategyDiagnostics.environmentType) {
      headers.set('x-debug-environment', strategyDiagnostics.environmentType);
    }
    
    // Add domain detection flags
    if (strategyDiagnostics.isWorkersDevDomain !== undefined) {
      headers.set('x-debug-is-workers-dev', String(strategyDiagnostics.isWorkersDevDomain));
    }
    
    if (strategyDiagnostics.isCustomDomain !== undefined) {
      headers.set('x-debug-is-custom-domain', String(strategyDiagnostics.isCustomDomain));
    }

    // Add strategy configuration info
    if (strategyDiagnostics.priorityOrder && strategyDiagnostics.priorityOrder.length > 0) {
      headers.set('x-debug-strategy-order', strategyDiagnostics.priorityOrder.join(','));
    }
    
    if (strategyDiagnostics.disabledStrategies && strategyDiagnostics.disabledStrategies.length > 0) {
      headers.set('x-debug-disabled-strategies', strategyDiagnostics.disabledStrategies.join(','));
    }
    
    if (strategyDiagnostics.enabledStrategies && strategyDiagnostics.enabledStrategies.length > 0) {
      headers.set('x-debug-enabled-strategies', strategyDiagnostics.enabledStrategies.join(','));
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
            headers.set('x-debug-route-config', JSON.stringify({
              pattern: config.pattern,
              environment: config.environment,
              hasStrategies: !!config.strategies
            }));
            
            // Add strategy priority if available
            if (config.strategies?.priorityOrder) {
              headers.set('x-debug-route-strategy-order', config.strategies.priorityOrder.join(','));
            }
          }
        }
      } catch (err) {
        // Ignore errors from environment service
      }
    }

    return enhancedResponse;
  } catch (err) {
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