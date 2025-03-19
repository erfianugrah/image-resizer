/**
 * Content Type Utilities
 * Centralized utilities for handling content types
 */
import { ILogger } from '../types/core/logger';

/**
 * Content Type Mapping
 * Maps file extensions to content types
 */
export const CONTENT_TYPE_MAP: Record<string, string> = {
  // Image formats
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  
  // Video formats
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  
  // Document formats
  pdf: 'application/pdf',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  txt: 'text/plain',
  
  // Font formats
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

/**
 * Image format extensions
 */
export const IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'
];

/**
 * Content Type Utilities Dependencies
 */
export interface ContentTypeUtilsDependencies {
  logger?: ILogger;
}

/**
 * Content Type Utilities Interface
 */
export interface IContentTypeUtils {
  /**
   * Get content type from file extension
   * @param filePathOrExt File path or extension
   * @param fallback Fallback content type if the extension is unknown
   * @returns Content type
   */
  getContentTypeFromPath(filePathOrExt: string, fallback?: string): string;
  
  /**
   * Get extension from content type
   * @param contentType Content type
   * @returns File extension or undefined if not found
   */
  getExtensionFromContentType(contentType: string): string | undefined;
  
  /**
   * Get preferred extension for content type
   * @param contentType Content type
   * @param defaultExt Default extension if none is found
   * @returns Preferred file extension
   */
  getPreferredExtension(contentType: string, defaultExt?: string): string;
  
  /**
   * Check if a file is an image based on extension
   * @param filePath File path
   * @returns Boolean indicating if it's an image
   */
  isImageFile(filePath: string): boolean;
  
  /**
   * Check if a content type is an image
   * @param contentType Content type
   * @returns Boolean indicating if it's an image
   */
  isImageContentType(contentType: string): boolean;
}

/**
 * Create Content Type Utilities
 * @param dependencies Utilities dependencies
 * @returns Content Type Utilities instance
 */
export function createContentTypeUtils(
  dependencies: ContentTypeUtilsDependencies = {}
): IContentTypeUtils {
  const { logger } = dependencies;
  
  // Build reverse mapping of content type to extension
  const contentTypeToExtension = new Map<string, string>();
  for (const [ext, contentType] of Object.entries(CONTENT_TYPE_MAP)) {
    // For duplicate content types, keep the first/canonical extension
    if (!contentTypeToExtension.has(contentType)) {
      contentTypeToExtension.set(contentType, ext);
    }
  }
  
  /**
   * Log helper function
   */
  const logDebug = (message: string, data?: Record<string, unknown>) => {
    if (logger) {
      logger.debug('ContentTypeUtils', message, data);
    }
  };
  
  return {
    getContentTypeFromPath: (filePathOrExt: string, fallback: string = 'application/octet-stream'): string => {
      // Get extension, handling both file paths and plain extensions
      let ext: string;
      
      // If it already looks like an extension without dots, use it directly
      if (!filePathOrExt.includes('.') && filePathOrExt.length <= 5) {
        ext = filePathOrExt.toLowerCase();
      } else {
        // Otherwise get extension from path
        ext = filePathOrExt.split('.').pop()?.toLowerCase() || '';
      }
      
      if (!ext) {
        logDebug('Could not determine extension from path', { filePathOrExt });
        return fallback;
      }
      
      const contentType = CONTENT_TYPE_MAP[ext];
      if (!contentType) {
        logDebug('Unknown file extension', { ext, filePathOrExt });
        return fallback;
      }
      
      return contentType;
    },
    
    getExtensionFromContentType: (contentType: string): string | undefined => {
      // Handle parameters in content type
      const baseType = contentType.split(';')[0].trim();
      
      return contentTypeToExtension.get(baseType);
    },
    
    getPreferredExtension: (contentType: string, defaultExt: string = 'bin'): string => {
      // Handle parameters in content type
      const baseType = contentType.split(';')[0].trim();
      
      return contentTypeToExtension.get(baseType) || defaultExt;
    },
    
    isImageFile: (filePath: string): boolean => {
      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      return IMAGE_EXTENSIONS.includes(ext);
    },
    
    isImageContentType: (contentType: string): boolean => {
      // Handle parameters in content type
      const baseType = contentType.split(';')[0].trim();
      
      return baseType.startsWith('image/');
    }
  };
}