/**
 * @deprecated Use the services/imageProcessingService.ts instead
 * Redirects to the new implementation using dependency injection
 */

import {
  createImageProcessingService,
  processImage as newProcessImage,
  ImageProcessingOptions,
} from '../services/imageProcessingService';

export { createImageProcessingService };
export type { ImageProcessingOptions };

// Export the legacy function for backward compatibility
export const processImage = newProcessImage;
