import { describe, test, expect, vi } from 'vitest';
import { addEnhancedDebugHeaders, StrategyDiagnostics, updateDiagnosticsWithStrategyInfo } from '../../src/utils/enhanced_debug_headers';
import { DebugInfo, DiagnosticsInfo } from '../../src/types/utils/debug';

describe('Enhanced Debug Headers Utilities', () => {
  describe('addEnhancedDebugHeaders', () => {
    test('should not modify response when debug is disabled', () => {
      // Arrange
      const response = new Response('test content', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      const debugInfo: DebugInfo = { isEnabled: false };
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['strategy1', 'strategy2'],
        selectedStrategy: 'strategy2'
      };

      // Act
      const result = addEnhancedDebugHeaders(response, debugInfo, strategyDiagnostics);

      // Assert
      expect(result.headers.get('x-debug-strategy-attempts')).toBeNull();
      expect(result.headers.get('x-debug-strategy-selected')).toBeNull();
    });

    test('should add strategy diagnostics headers when debug is enabled', () => {
      // Arrange
      const response = new Response('test content', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      const debugInfo: DebugInfo = { 
        isEnabled: true, 
        prefix: 'debug-' // Make sure we use the same prefix as in the implementation
      };
      
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['strategy1', 'strategy2'],
        selectedStrategy: 'strategy2',
        failedStrategies: {
          strategy1: 'Error: test error'
        },
        domainType: 'custom',
        environmentType: 'production',
        priorityOrder: ['strategy1', 'strategy2', 'strategy3'],
        isWorkersDevDomain: false,
        isCustomDomain: true
      };

      // Act
      const result = addEnhancedDebugHeaders(response, debugInfo, strategyDiagnostics);

      // Assert - using the debug- prefix to match the implementation
      expect(result.headers.get('debug-strategy-attempts')).toBe('strategy1,strategy2');
      expect(result.headers.get('debug-strategy-selected')).toBe('strategy2');
      expect(result.headers.get('debug-strategy-failures')).toBe('strategy1:Error: test error');
      expect(result.headers.get('debug-domain-type')).toBe('custom');
      expect(result.headers.get('debug-environment')).toBe('production');
      expect(result.headers.get('debug-strategy-order')).toBe('strategy1,strategy2,strategy3');
      expect(result.headers.get('debug-is-workers-dev')).toBe('false');
      expect(result.headers.get('debug-is-custom-domain')).toBe('true');
    });

    test('should add route config headers when environment service is provided', () => {
      // Arrange
      // Create a response that has a url property
      const mockResponse = new Response('test content', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      // Add url property manually (not standard in Response but needed for our test)
      Object.defineProperty(mockResponse, 'url', {
        value: 'https://images.erfi.dev/test.jpg',
        writable: true
      });
      
      const response = mockResponse;
      const debugInfo: DebugInfo = { 
        isEnabled: true,
        prefix: 'debug-' // Make sure we use the same prefix as in the implementation
      };
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['strategy1'],
        selectedStrategy: 'strategy1'
      };
      const environmentService = {
        getDomain: vi.fn(() => 'images.erfi.dev'),
        isWorkersDevDomain: vi.fn(() => false),
        isCustomDomain: vi.fn(() => true),
        getEnvironmentForDomain: vi.fn(() => 'production'),
        getRouteConfigForUrl: vi.fn(() => ({
          pattern: 'images.erfi.dev/*',
          environment: 'production',
          strategies: {
            priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
            disabled: ['cdn-cgi']
          }
        })),
        getStrategyPriorityOrderForUrl: vi.fn(),
        isStrategyEnabledForUrl: vi.fn()
      };

      // Act
      const result = addEnhancedDebugHeaders(response, debugInfo, strategyDiagnostics, environmentService);

      // Assert - using the debug- prefix to match the implementation
      expect(result.headers.get('debug-route-config')).toBe(JSON.stringify({
        pattern: 'images.erfi.dev/*',
        environment: 'production',
        hasStrategies: true
      }));
      expect(result.headers.get('debug-route-strategy-order')).toBe('interceptor,direct-url,remote-fallback,direct-serving');
    });

    test('should handle errors gracefully', () => {
      // Arrange
      const response = new Response('test content');
      const debugInfo: DebugInfo = { isEnabled: true };
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['strategy1']
      };
      const environmentService = {
        getDomain: vi.fn(() => { throw new Error('Test error'); }),
        isWorkersDevDomain: vi.fn(),
        isCustomDomain: vi.fn(),
        getEnvironmentForDomain: vi.fn(),
        getRouteConfigForUrl: vi.fn(),
        getStrategyPriorityOrderForUrl: vi.fn(),
        isStrategyEnabledForUrl: vi.fn()
      };

      // Act & Assert
      expect(() => {
        addEnhancedDebugHeaders(response, debugInfo, strategyDiagnostics, environmentService);
      }).not.toThrow();
    });
  });

  describe('updateDiagnosticsWithStrategyInfo', () => {
    test('should update diagnostics info with strategy diagnostics', () => {
      // Arrange
      const diagnosticsInfo: DiagnosticsInfo = {
        originalUrl: 'https://images.erfi.dev/test.jpg',
        processingTimeMs: 100
      };
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['strategy1', 'strategy2'],
        selectedStrategy: 'strategy2',
        failedStrategies: {
          strategy1: 'Error: test error'
        },
        domainType: 'custom',
        environmentType: 'production',
        priorityOrder: ['strategy1', 'strategy2', 'strategy3'],
        disabledStrategies: ['strategy4'],
        enabledStrategies: ['strategy1', 'strategy2', 'strategy3'],
        isWorkersDevDomain: false,
        isCustomDomain: true
      };

      // Act
      const result = updateDiagnosticsWithStrategyInfo(diagnosticsInfo, strategyDiagnostics);

      // Assert
      expect(result).toEqual({
        originalUrl: 'https://images.erfi.dev/test.jpg',
        processingTimeMs: 100,
        attemptedStrategies: ['strategy1', 'strategy2'],
        selectedStrategy: 'strategy2',
        failedStrategies: {
          strategy1: 'Error: test error'
        },
        domainType: 'custom',
        environmentType: 'production',
        strategyPriorityOrder: ['strategy1', 'strategy2', 'strategy3'],
        disabledStrategies: ['strategy4'],
        enabledStrategies: ['strategy1', 'strategy2', 'strategy3'],
        isWorkersDevDomain: false,
        isCustomDomain: true
      });
    });
  });
});