# Cloudflare Image Resizing Worker

A highly configurable, modular Cloudflare Worker for dynamic image resizing, optimization, and transformation. This worker provides advanced responsive image capabilities with support for multiple predefined derivatives, client hints, and remote bucket integration.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Responsive Images](#responsive-images)
- [Cache Configuration](#cache-configuration)
- [Derivatives](#derivatives)
- [Remote Bucket Support](#remote-bucket-support)
- [Advanced Features](#advanced-features)
- [Deployment Modes](#deployment-modes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Demo](#demo)

## ✨ Features

- **Automatic device detection**: Serves optimal image sizes based on device type and screen size
- **Predefined derivatives**: Built-in configurations for common use cases like headers, thumbnails, etc.
- **Client hints support**: Advanced responsive images using browser client hints
- **Remote bucket integration**: Process images from different origins/buckets
- **Modern format handling**: AVIF with WebP fallback based on browser support
- **Configurable caching**: Fine-grained cache control based on response status
- **Performance optimization**: Tiered caching and optimal compression

## 🏗️ Architecture

The worker uses a modular architecture with clear separation of concerns:

### Core Components

- **Entry point**: Handles request routing and environment configuration
- **Image handler**: Orchestrates the image processing workflow
- **Image options service**: Determines the appropriate transformation options
- **Image processing service**: Applies the transformations via Cloudflare's service

### Utilities

- **Format utilities**: Format detection and handling
- **Client hints utilities**: Processing client hints headers for responsive images
- **Device detection utilities**: Identifying device types for optimal sizing
- **URL transformation utilities**: Handling remote bucket requests
- **Cache control utilities**: Managing cache headers and TTLs

## 📥 Installation

### Prerequisites

- Cloudflare account with Workers enabled
- Cloudflare Image Resizing service enabled on your account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/erfianugrah/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Authenticate wrangler with your Cloudflare account:
   ```bash
   wrangler login
   ```

4. Configure `wrangler.toml` with your account ID and zone ID:
   ```toml
   account_id = "your-account-id"
   ```

## ⚙️ Configuration

### Environment Configuration

Edit `wrangler.toml` to configure different environments:

```toml
# Direct mode deployment (worker runs on the bucket)
[env.direct]
name = "direct-resizer"

[env.direct.vars]
ENVIRONMENT = "development"
DEPLOYMENT_MODE = "direct"
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"thumbnail\",\"hero-banners\":\"header\"}"
VERSION = "1.1.0"
FALLBACK_BUCKET = "https://cdn.example.com"

# Remote mode deployment (worker fetches from remote buckets)
[env.remote]
name = "remote-resizer"

[env.remote.vars]
ENVIRONMENT = "development"
DEPLOYMENT_MODE = "remote"
REMOTE_BUCKETS = "{\"default\":\"https://cdn.example.com\"}"
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"thumbnail\",\"hero-banners\":\"header\"}"
PATH_TRANSFORMS = "{\"images\":{\"prefix\":\"\",\"removePrefix\":true}}"
VERSION = "1.1.0"
FALLBACK_BUCKET = "https://cdn.example.com"

# Staging environment
[env.staging]
name = "staging-resizer"

[env.staging.vars]
ENVIRONMENT = "staging"
DEPLOYMENT_MODE = "remote"
REMOTE_BUCKETS = "{\"default\":\"https://cdn.example.com\"}"
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"thumbnail\",\"hero-banners\":\"header\"}"
PATH_TRANSFORMS = "{\"images\":{\"prefix\":\"\",\"removePrefix\":true}}"
VERSION = "1.1.0"
FALLBACK_BUCKET = "https://cdn.example.com"

[[env.staging.routes]]
pattern = "staging.images.example.com/*"
zone_id = "your-zone-id"

# Production environment
[env.prod]
name = "prod-resizer"

[env.prod.vars]
ENVIRONMENT = "production"
DEPLOYMENT_MODE = "remote"
REMOTE_BUCKETS = "{\"default\":\"https://cdn.example.com\"}"
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"thumbnail\",\"hero-banners\":\"header\"}"
PATH_TRANSFORMS = "{\"images\":{\"prefix\":\"\",\"removePrefix\":true}}"
VERSION = "1.1.0"
FALLBACK_BUCKET = "https://cdn.example.com"

[[env.prod.routes]]
pattern = "images.example.com/*"
zone_id = "your-zone-id"
```

> **Note**: All environment variables must be defined in each environment's `vars` section. Wrangler doesn't inherit variables from the top level.

### Image Configuration

Edit `src/config/imageConfig.js` to customize image derivatives and cache settings:

```javascript
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
    // Header image configuration
    header: {
      width: 1600,
      height: 800, // 2:1 aspect ratio
      quality: 80,
      fit: "scale-down",
      upscale: false,
    },
    // Thumbnail configuration
    thumbnail: {
      width: 150,
      height: 150, // Square thumbnails
      quality: 85,
      fit: "scale-down",
    },
    // Default policy (multiple responsive sizes)
    default: {
      widths: [320, 640, 1024, 2048, 5000],
      responsiveWidths: [320, 768, 960, 1200], // For device detection
      quality: 85,
      fit: "contain",
    },
  },
};
```

## 🚀 Usage

### Basic Usage

Once deployed, you can use the worker to resize images with:

```
https://example.com/image.jpg                   # Default sizing
https://example.com/image.jpg?width=800         # Specific width
https://example.com/image.jpg?width=800&height=600  # Custom dimensions
https://example.com/image.jpg?quality=90        # Custom quality
```

### Derivatives

Use predefined derivatives via URL path or query parameter:

```
https://example.com/header/image.jpg            # Header derivative via path
https://example.com/thumbnail/image.jpg         # Thumbnail derivative via path

https://example.com/image.jpg?derivative=header # Header derivative via parameter
```

### Format Control

Control output format:

```
https://example.com/image.jpg?format=webp       # Force WebP format
https://example.com/image.jpg?format=avif       # Force AVIF format
https://example.com/image.jpg?format=auto       # Auto format based on browser support
```

### Additional Parameters

```
https://example.com/image.jpg?fit=contain       # Resize mode (contain, cover, crop, scale-down)
https://example.com/image.jpg?metadata=none     # Metadata handling (none, copyright, all)
https://example.com/image.jpg?upscale=false     # Prevent upscaling
```

## 📱 Responsive Images

### Automatic Responsive Images

Use the `width=auto` parameter to automatically serve the appropriate size based on device:

```
https://example.com/image.jpg?width=auto
```

When `width=auto` is explicitly requested, we pass it directly to Cloudflare's native resizing service, which uses client hints and other factors to optimize the image size.

For implicit responsive sizing (when no width is specified), we use a sophisticated priority system:

1. **Client hints**: For browsers that support client hints, we pass `width=auto` to Cloudflare
2. **CF-Device-Type**: For browsers without client hints but with Cloudflare's device detection:
   - Mobile: 480px (480p)  
   - Tablet: 720px (720p)
   - Desktop: 1080px (1080p)
3. **User-Agent analysis**: For browsers without the above, as a last resort

### Setting Up Client Hints

For best results with `width=auto`, add this to your HTML:

```html
<meta http-equiv="Delegate-CH" content="sec-ch-dpr https://example.com; sec-ch-viewport-width https://example.com"/>
```

Or via HTTP headers:

```
Accept-CH: Sec-CH-DPR, Sec-CH-Viewport-Width
Critical-CH: Sec-CH-DPR, Sec-CH-Viewport-Width
```

### HTML Responsive Images with srcset

For maximum compatibility, use HTML's native responsive image features:

```html
<img 
  src="/image.jpg?width=800" 
  srcset="
    /image.jpg?width=320 320w,
    /image.jpg?width=768 768w,
    /image.jpg?width=1024 1024w,
    /image.jpg?width=1600 1600w
  "
  sizes="(max-width: 768px) 100vw, 768px"
  alt="Description"
/>
```

## 🔄 Cache Configuration

Images are cached by Cloudflare based on the TTL settings in `imageConfig.js`. You can customize:

- **Cache TTL**: Different TTLs for different HTTP status codes
- **Cache Tags**: Automatic tagging for better cache management
- **Polish**: Cloudflare's additional image optimization
- **Mirage**: Cloudflare's lazy loading feature

## 🎯 Derivatives

Derivatives are predefined transformation configurations for common use cases:

- **Header**: Optimized for hero/header images (1600px wide, customizable aspect ratio, 80% quality)
- **Thumbnail**: Optimized for thumbnails (150px square, 85% quality)
- **Default**: Used when no specific derivative is requested

### Custom Derivatives

You can define additional derivatives in `imageConfig.js`:

```javascript
derivatives: {
  // Your custom derivative
  profile: {
    width: 200,
    height: 200,
    quality: 90,
    fit: "cover",
  },
  // ...
}
```

Then add it to your path detection in `pathUtils.js`:

```javascript
export function getDerivativeFromPath(path) {
  if (path.includes("/header/")) {
    return "header";
  } else if (path.includes("/thumbnail/")) {
    return "thumbnail";
  } else if (path.includes("/profile/")) {
    return "profile";  // Your new derivative
  }
  return null;
}
```

You can also add it to route-based derivatives in `wrangler.toml`:

```toml
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"profile\"}"
```

## 🪣 Remote Bucket Support

The worker can fetch and process images from remote origins:

### Configuration

Configure remote buckets in `wrangler.toml`:

```toml
[env.remote.vars]
DEPLOYMENT_MODE = "remote"
REMOTE_BUCKETS = "{\"default\":\"https://cdn.example.com\",\"images\":\"https://images.example.com\"}"
```

### Usage

```
https://your-worker.com/default/image.jpg    # Fetches from https://cdn.example.com/image.jpg
https://your-worker.com/images/photo.jpg     # Fetches from https://images.example.com/photo.jpg
```

## 🔍 Advanced Features

### Route-Based Derivatives

You can configure automatic derivative selection based on URL paths:

```javascript
// In wrangler.toml
ROUTE_DERIVATIVES = "{\"profile-pictures\":\"thumbnail\",\"hero-banners\":\"header\"}"
```

This automatically applies the thumbnail derivative to any URL containing `/profile-pictures/`.

### Path Transformations

You can configure path transformations for remote buckets:

```javascript
// In wrangler.toml
PATH_TRANSFORMS = "{\"images\":{\"prefix\":\"assets\",\"removePrefix\":true}}"
```

This would transform a request for `/images/photo.jpg` to fetch from `/assets/photo.jpg` on the remote origin.

## 🚢 Deployment Modes

The worker supports two deployment modes:

### Direct Mode

The worker runs on the same zone as your images. This is simpler and more efficient:

```
[YOUR DOMAIN]
   |
   |-- Cloudflare Worker
   |-- Your Images
```

### Remote Mode

The worker runs on its own domain and fetches images from other origins:

```
[WORKER DOMAIN] --> [IMAGE ORIGIN 1]
                 --> [IMAGE ORIGIN 2]
```

Configure remote mode for:
- Serving images from multiple origins
- Processing images from non-Cloudflare origins
- Creating a dedicated image service

## 🔧 Troubleshooting

### Debug Headers

The worker adds debug headers to every response:

- `debug-ir`: Shows the image transformation options used
- `debug-cache`: Shows the cache configuration
- `debug-mode`: Shows deployment mode and request transformation details
- `x-derivative`: Shows the derivative used
- `x-size-source`: Shows how the image size was determined

Example debug header values:
```
x-derivative: header
x-size-source: derivative-header
debug-ir: {"width":1600,"height":73,"quality":80,"fit":"scale-down","upscale":false,"source":"derivative-header","derivative":"header","format":"avif"}
```

### Common Issues

1. **Images not resizing**: Ensure Image Resizing is enabled on your Cloudflare account
2. **workers.dev domain not working**: Image Resizing may not be available on workers.dev - deploy to your own domain
3. **Remote images not loading**: Check CORS settings on your remote bucket
4. **Incorrect sizes**: Check the debug headers to see how sizing decisions are made
5. **Deployment warnings**: Ensure all environment variables are duplicated in each environment's `vars` section
6. **Deployment failures**: Check that your wrangler.toml doesn't contain unsupported fields like `security` or `analytics`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Test locally: `wrangler dev`
5. Deploy to test: `wrangler deploy`

### Code Organization

- `src/handlers/`: Contains the main request handlers
- `src/utils/`: Contains utility functions for various aspects
- `src/config/`: Contains configuration files

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

# Demo

This document demonstrates the various image transformation capabilities of the Cloudflare Image Resizing Worker using a sample image.

## Basic Usage

### Original Image
![Original Image](https://images.erfi.dev/Granna_1.JPG)
```
https://images.erfi.dev/Granna_1.JPG
```

### Specific Width (800px)
![Width 800px](https://images.erfi.dev/Granna_1.JPG?width=800)
```
https://images.erfi.dev/Granna_1.JPG?width=800
```

### Custom Dimensions (800x600)
![Custom Dimensions](https://images.erfi.dev/Granna_1.JPG?width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?width=800&height=600
```

### Custom Quality (90%)
![Custom Quality](https://images.erfi.dev/Granna_1.JPG?quality=90)
```
https://images.erfi.dev/Granna_1.JPG?quality=90
```

## Derivatives

### Header Derivative via Path
![Header Derivative](https://images.erfi.dev/header/Granna_1.JPG)
```
https://images.erfi.dev/header/Granna_1.JPG
```

### Thumbnail Derivative via Path
![Thumbnail Derivative](https://images.erfi.dev/thumbnail/Granna_1.JPG)
```
https://images.erfi.dev/thumbnail/Granna_1.JPG
```

### Header Derivative via Parameter
![Header Parameter](https://images.erfi.dev/Granna_1.JPG?derivative=header)
```
https://images.erfi.dev/Granna_1.JPG?derivative=header
```

### Thumbnail Derivative via Parameter
![Thumbnail Parameter](https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail)
```
https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail
```

## Format Control

### Force WebP Format
![WebP Format](https://images.erfi.dev/Granna_1.JPG?format=webp)
```
https://images.erfi.dev/Granna_1.JPG?format=webp
```

### Force AVIF Format
![AVIF Format](https://images.erfi.dev/Granna_1.JPG?format=avif)
```
https://images.erfi.dev/Granna_1.JPG?format=avif
```

### Auto Format Based on Browser Support
![Auto Format](https://images.erfi.dev/Granna_1.JPG?format=auto)
```
https://images.erfi.dev/Granna_1.JPG?format=auto
```

## Additional Parameters

### Resize Mode: Contain
![Fit Contain](https://images.erfi.dev/Granna_1.JPG?fit=contain&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=contain&width=800&height=600
```

### Resize Mode: Cover
![Fit Cover](https://images.erfi.dev/Granna_1.JPG?fit=cover&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=cover&width=800&height=600
```

### Resize Mode: Crop
![Fit Crop](https://images.erfi.dev/Granna_1.JPG?fit=crop&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=crop&width=800&height=600
```

### Resize Mode: Scale-down
![Fit Scale-down](https://images.erfi.dev/Granna_1.JPG?fit=scale-down&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=scale-down&width=800&height=600
```

### Metadata Handling: None
![Metadata None](https://images.erfi.dev/Granna_1.JPG?metadata=none)
```
https://images.erfi.dev/Granna_1.JPG?metadata=none
```

### Metadata Handling: Copyright
![Metadata Copyright](https://images.erfi.dev/Granna_1.JPG?metadata=copyright)
```
https://images.erfi.dev/Granna_1.JPG?metadata=copyright
```

### Metadata Handling: All
![Metadata All](https://images.erfi.dev/Granna_1.JPG?metadata=all)
```
https://images.erfi.dev/Granna_1.JPG?metadata=all
```

### Prevent Upscaling
![Prevent Upscaling](https://images.erfi.dev/Granna_1.JPG?width=3000&upscale=false)
```
https://images.erfi.dev/Granna_1.JPG?width=3000&upscale=false
```

## Responsive Images

### Automatic Responsive Sizing
![Responsive Sizing](https://images.erfi.dev/Granna_1.JPG?width=auto)
```
https://images.erfi.dev/Granna_1.JPG?width=auto
```

## Combined Transformations

### Thumbnail with WebP Format
![Thumbnail WebP](https://images.erfi.dev/thumbnail/Granna_1.JPG?format=webp)
```
https://images.erfi.dev/thumbnail/Granna_1.JPG?format=webp
```

### Header with Custom Quality
![Header Custom Quality](https://images.erfi.dev/header/Granna_1.JPG?quality=95)
```
https://images.erfi.dev/header/Granna_1.JPG?quality=95
```

### Custom Size with Specific Format and Fit
![Complex Transformation](https://images.erfi.dev/Granna_1.JPG?width=1200&height=675&format=webp&fit=cover&quality=85)
```
https://images.erfi.dev/Granna_1.JPG?width=1200&height=675&format=webp&fit=cover&quality=85
```

## HTML Responsive Images Implementation

For responsive images in HTML, use the following pattern:

```html
<img 
  src="https://images.erfi.dev/Granna_1.JPG?width=800" 
  srcset="
    https://images.erfi.dev/Granna_1.JPG?width=320 320w,
    https://images.erfi.dev/Granna_1.JPG?width=768 768w,
    https://images.erfi.dev/Granna_1.JPG?width=1024 1024w,
    https://images.erfi.dev/Granna_1.JPG?width=1600 1600w
  "
  sizes="(max-width: 768px) 100vw, 768px"
  alt="Granna landscape"
/>
```

## Debug Information

Then check the response headers for:
- `debug-ir`: Shows image transformation options
- `debug-cache`: Shows cache configuration
- `debug-mode`: Shows deployment mode details
- `x-derivative`: Shows the derivative used
- `x-size-source`: Shows how the image size was determined
