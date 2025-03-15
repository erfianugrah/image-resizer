/**
 * Environment configuration for the image resizer
 */
import { PathPattern } from '../utils/pathUtils';
import { debug } from '../utils/loggerUtils';

export interface EnvironmentConfig {
  mode: string;
  version: string;
  fallbackBucket?: string;
  debug?: {
    enabled: boolean;
    verbose?: boolean;
    includeHeaders?: string[];
  };
  cache: {
    method: string;
    debug: boolean;
  };
  derivatives?: Record<string, any>;
  pathTemplates?: Record<string, string>;
  remoteBuckets?: Record<string, string>;
  pathTransforms?: Record<string, { prefix: string; removePrefix: boolean }>;
  pathPatterns?: PathPattern[];
}

/**
 * Get environment configuration from the worker environment
 * @param env - The worker environment
 * @returns Environment configuration
 */
export function getEnvironmentConfig(env: any): EnvironmentConfig {
  const config: EnvironmentConfig = {
    mode: env.DEPLOYMENT_MODE || 'direct',
    version: env.VERSION || '1.0.0',
    fallbackBucket: env.FALLBACK_BUCKET,
    cache: {
      method: env.CACHE_METHOD || 'cache-api',
      debug: env.CACHE_DEBUG === 'true',
    },
  };

  // Debug configuration
  if (env.DEBUG_HEADERS_CONFIG) {
    try {
      const debugConfig = typeof env.DEBUG_HEADERS_CONFIG === 'string'
        ? JSON.parse(env.DEBUG_HEADERS_CONFIG)
        : env.DEBUG_HEADERS_CONFIG;

      config.debug = {
        enabled: debugConfig.enabled,
        verbose: debugConfig.verbose,
        includeHeaders: debugConfig.includeHeaders,
      };
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing DEBUG_HEADERS_CONFIG', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Derivatives (templates)
  if (env.DERIVATIVE_TEMPLATES) {
    try {
      config.derivatives = typeof env.DERIVATIVE_TEMPLATES === 'string'
        ? JSON.parse(env.DERIVATIVE_TEMPLATES)
        : env.DERIVATIVE_TEMPLATES;
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing DERIVATIVE_TEMPLATES', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Path templates
  if (env.PATH_TEMPLATES) {
    try {
      config.pathTemplates = typeof env.PATH_TEMPLATES === 'string'
        ? JSON.parse(env.PATH_TEMPLATES)
        : env.PATH_TEMPLATES;
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing PATH_TEMPLATES', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Remote buckets
  if (env.REMOTE_BUCKETS) {
    try {
      config.remoteBuckets = typeof env.REMOTE_BUCKETS === 'string'
        ? JSON.parse(env.REMOTE_BUCKETS)
        : env.REMOTE_BUCKETS;
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing REMOTE_BUCKETS', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // Path transforms
  if (env.PATH_TRANSFORMS) {
    try {
      config.pathTransforms = typeof env.PATH_TRANSFORMS === 'string'
        ? JSON.parse(env.PATH_TRANSFORMS)
        : env.PATH_TRANSFORMS;
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing PATH_TRANSFORMS', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }
  
  // Path patterns
  if (env.PATH_PATTERNS) {
    try {
      config.pathPatterns = typeof env.PATH_PATTERNS === 'string'
        ? JSON.parse(env.PATH_PATTERNS)
        : env.PATH_PATTERNS;
    } catch (err) {
      debug('EnvironmentConfig', 'Error parsing PATH_PATTERNS', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return config;
}