/**
 * Path utilities for image-resizer
 */

// Path pattern interface for route matching
export interface PathPattern {
  name: string;
  matcher: string;
  originUrl?: string;
  processPath?: boolean;
  cacheTtl?: number;
  captureGroups?: boolean;
  transformationOverrides?: Record<string, any>;
  quality?: string;
}

/**
 * Determine derivative type from URL path
 * @param path - The URL path
 * @param config - Environment configuration
 * @returns Derivative type or null if no match
 */
export function getDerivativeFromPath(path: string, config: any = null): string | null {
  // Import configuration dynamically to avoid circular dependencies
  const getDerivatives = async () => {
    const { imageConfig } = await import("../config/imageConfig");
    return Object.keys(imageConfig.derivatives || {});
  };

  // Use immediately available derivatives if possible
  let knownDerivatives: string[] = [];
  if (config?.derivatives) {
    knownDerivatives = Object.keys(config.derivatives);
  } else {
    // For now, use a basic set until async imports are possible
    knownDerivatives = ['thumbnail', 'header', 'avatar', 'product'];
  }

  // Check for exact path segments to avoid partial matches
  const segments = path.split("/").filter((segment) => segment);

  // Check first segment specifically
  if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
    return segments[0];
  }

  // If config is available, check path templates
  if (config && config.pathTemplates) {
    const matchedPath = Object.keys(config.pathTemplates).find((pathPattern) =>
      path.includes(`/${pathPattern}/`)
    );

    if (matchedPath) {
      return config.pathTemplates[matchedPath];
    }
  }

  // Fallback to substring check for backward compatibility
  for (const derivative of knownDerivatives) {
    if (path.includes(`/${derivative}/`)) {
      return derivative;
    }
  }

  return null;
}

/**
 * Check if the path contains image file extension
 * @param path - The URL path
 * @returns True if path ends with image extension
 */
export function isImagePath(path: string): boolean {
  return /\.(jpe?g|JPG|png|gif|webp|svg|avif)$/i.test(path);
}

/**
 * Extract filename from path
 * @param path - The URL path
 * @returns Filename
 */
export function getFilenameFromPath(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1];
}

/**
 * Find a matching path pattern for a given URL path
 * @param path - The URL path
 * @param patterns - Array of path patterns to match against
 * @returns Matching pattern or undefined if no match
 */
export function findMatchingPathPattern(path: string, patterns: PathPattern[]): PathPattern | undefined {
  return patterns.find(pattern => {
    const regex = new RegExp(pattern.matcher);
    return regex.test(path);
  });
}

/**
 * Match a path with capture groups
 * @param path - The URL path
 * @param patterns - Array of path patterns to match against
 * @returns Match result with captures or null if no match
 */
export interface PathMatch {
  pattern: PathPattern;
  captures: Record<string, string>;
}

export function matchPathWithCaptures(path: string, patterns: PathPattern[]): PathMatch | null {
  for (const pattern of patterns) {
    // Only process patterns with capture groups
    if (pattern.captureGroups) {
      const regex = new RegExp(pattern.matcher);
      const match = path.match(regex);
      
      if (match) {
        const captures: Record<string, string> = {};
        
        // Add numbered captures
        for (let i = 1; i < match.length; i++) {
          captures[i.toString()] = match[i];
        }
        
        // Check for named capture groups if available
        if (match.groups) {
          Object.assign(captures, match.groups);
        }
        
        return {
          pattern,
          captures
        };
      }
    } else {
      // For patterns without capture groups, just check for a match
      const regex = new RegExp(pattern.matcher);
      if (regex.test(path)) {
        return {
          pattern,
          captures: {}
        };
      }
    }
  }
  
  return null;
}

/**
 * Extract a video ID from a path (primarily for path pattern with video IDs)
 * @param path - The URL path
 * @param pattern - The path pattern
 * @returns Video ID or null if not found
 */
export function extractVideoId(path: string, pattern: PathPattern): string | null {
  if (pattern.captureGroups) {
    const match = matchPathWithCaptures(path, [pattern]);
    if (match && match.captures['videoId']) {
      return match.captures['videoId'];
    }
  }
  
  // Fallback to regex extraction
  const regex = new RegExp(pattern.matcher);
  const match = path.match(regex);
  
  if (match && match.length > 1) {
    return match[1]; // Assume first capture group is the ID
  }
  
  return null;
}