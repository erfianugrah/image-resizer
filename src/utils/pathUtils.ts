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
  transformationOverrides?: Record<string, string | number | boolean | null | undefined>;
  quality?: string;
}

/**
 * Determine derivative type from URL path
 * @param path - The URL path
 * @param pathTemplates - Path to derivative name mappings
 * @returns Derivative type or null if no match
 */
export function getDerivativeFromPath(
  path: string,
  pathTemplates?: Record<string, string>
): string | null {
  // Check if we have path templates
  if (!pathTemplates || Object.keys(pathTemplates).length === 0) {
    // Use default templates when none are provided
    pathTemplates = {
      thumbnail: 'thumbnail',
      header: 'header',
      avatar: 'avatar',
      product: 'product',
      'profile-pictures': 'avatar',
      'hero-banners': 'header',
    };
  }

  // Check for exact path segments to avoid partial matches
  const segments = path.split('/').filter((segment) => segment);

  // Check first segment specifically
  if (segments.length > 0) {
    // Check if the segment is directly a template key
    if (Object.keys(pathTemplates).includes(segments[0])) {
      return pathTemplates[segments[0]];
    }

    // Check if the segment itself is a valid derivative name
    if (Object.values(pathTemplates).includes(segments[0])) {
      return segments[0];
    }
  }

  // Check for path patterns
  for (const [pathPattern, derivativeName] of Object.entries(pathTemplates)) {
    // Check if the path includes the pattern as a segment
    if (path.includes(`/${pathPattern}/`)) {
      return derivativeName;
    }
  }

  // Check if any derivative name itself is in the path (backward compatibility)
  const derivativeNames = new Set(Object.values(pathTemplates));
  for (const derivative of derivativeNames) {
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
  const segments = path.split('/');
  return segments[segments.length - 1];
}

/**
 * Find a matching path pattern for a given URL path
 * @param path - The URL path
 * @param patterns - Array of path patterns to match against
 * @returns Matching pattern or undefined if no match
 */
export function findMatchingPathPattern(
  path: string,
  patterns: PathPattern[]
): PathPattern | undefined {
  return patterns.find((pattern) => {
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
          captures,
        };
      }
    } else {
      // For patterns without capture groups, just check for a match
      const regex = new RegExp(pattern.matcher);
      if (regex.test(path)) {
        return {
          pattern,
          captures: {},
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
