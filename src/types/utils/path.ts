/**
 * Path utilities interfaces
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
  [key: string]: unknown;
}

/**
 * PathMatch interface for results of matching a path with captures
 */
export interface PathMatch {
  pattern: PathPattern;
  captures: Record<string, string>;
}

/**
 * Interface for path utility service
 */
export interface IPathUtils {
  /**
   * Determine derivative type from URL path
   * @param path - The URL path
   * @param pathTemplates - Path to derivative name mappings
   * @returns Derivative type or null if no match
   */
  getDerivativeFromPath(path: string, pathTemplates?: Record<string, string>): string | null;

  /**
   * Check if the path contains image file extension
   * @param path - The URL path
   * @returns True if path ends with image extension
   */
  isImagePath(path: string): boolean;

  /**
   * Extract filename from path
   * @param path - The URL path
   * @returns Filename
   */
  getFilenameFromPath(path: string): string;

  /**
   * Find a matching path pattern for a given URL path
   * @param path - The URL path
   * @param patterns - Array of path patterns to match against
   * @returns Matching pattern or undefined if no match
   */
  findMatchingPathPattern(path: string, patterns: PathPattern[]): PathPattern | undefined;

  /**
   * Match a path with capture groups
   * @param path - The URL path
   * @param patterns - Array of path patterns to match against
   * @returns Match result with captures or null if no match
   */
  matchPathWithCaptures(path: string, patterns: PathPattern[]): PathMatch | null;

  /**
   * Extract a video ID from a path (primarily for path pattern with video IDs)
   * @param path - The URL path
   * @param pattern - The path pattern
   * @returns Video ID or null if not found
   */
  extractVideoId(path: string, pattern: PathPattern): string | null;
}

/**
 * Dependencies for PathUtils factory
 */
export interface PathUtilsDependencies {
  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
