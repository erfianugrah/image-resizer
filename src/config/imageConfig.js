// Configuration for image resizing
export const imageConfig = {
  cache: {
    image: {
      regex: /^.*\.(jpe?g|JPG|png|gif|webp|svg)$/,
      ttl: {
        ok: 31536000, // 1 year for successful responses
        redirects: 31536000, // 1 year for redirects
        clientError: 10, // 10 seconds for client errors
        serverError: 1, // 1 second for server errors
      },
      cacheability: true,
      mirage: false,
      imageCompression: "off",
    },
  },
  derivatives: {
    // Header resize configuration (1600px, 1:22 ratio, 80% quality)
    header: {
      width: 1600,
      height: Math.floor(1600 / 22), // Based on 1:22 aspect ratio
      quality: 80,
      fit: "crop",
      upscale: false,
    },
    // Thumbnail configuration (150px, 1:27 ratio, 85% quality)
    thumbnail: {
      width: 150,
      height: Math.floor(150 / 27), // Based on 1:27 aspect ratio
      quality: 85,
      fit: "crop",
    },
    // Default policy (multiple sizes, 1:30 ratio, 85% quality)
    default: {
      widths: [320, 640, 1024, 2048, 5000],
      responsiveWidths: [320, 768, 960, 1200], // For width=auto
      aspectRatio: 1 / 30, // 1:30 aspect ratio
      quality: 85,
      fit: "crop",
    },
  },
};
