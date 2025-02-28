# Cloudflare Image Resizing Worker

This modular Cloudflare Worker provides advanced image resizing capabilities with support for multiple derivatives, responsive images, and client hints.

## Directory Structure

```
├── src/
│   ├── index.js                  # Main worker entry point
│   ├── config/
│   │   ├── imageConfig.js        # Configuration for image resizing
│   │   └── environmentConfig.js  # Remote bucket and route configuration
│   ├── handlers/
│   │   └── imageHandler.js       # Main image handling functions
│   └── utils/
│       ├── cacheUtils.js         # Cache-related utility functions
│       ├── clientHints.js        # Client hints handling
│       └── pathUtils.js          # URL path parsing utilities
├── wrangler.toml                 # Cloudflare Workers configuration
├── package.json                  # NPM package configuration
└── README.md                     # Documentation
```

## Features

- **Predefined Derivatives**:
  - **Header Images**: 1600px width, 1:22 aspect ratio, 80% quality
  - **Thumbnails**: 150px width, 1:27 aspect ratio, 85% quality
  - **Default Policy**: Multiple sizes, 1:30 aspect ratio, 85% quality

- **Remote Bucket Support**:
  - Process images from other buckets/origins
  - Map route prefixes to specific remote origins
  - Apply different derivatives based on route

- **Advanced Features**:
  - **Auto Responsive Sizing**: Automatic selection of optimal image size
  - **Client Hints Support**: Uses `Sec-CH-Viewport-Width` and `Sec-CH-DPR`
  - **Modern Format Selection**: AVIF with WebP fallback
  - **Optimized Caching**: Configurable TTLs for different status codes

## How to Use

### Basic Usage

```
https://example.com/images/photo.jpg
```

Returns the image using the default 1024px width settings.

### Remote Bucket Usage

```
https://example.com/remote-images/photo.jpg
```

Fetches the image from a remote bucket and processes it with the default settings.

### Derivative Configurations

```
https://example.com/images/header/photo.jpg     # Uses header configuration
https://example.com/images/thumbnail/photo.jpg  # Uses thumbnail configuration
```

Or use the derivative parameter:

```
https://example.com/images/photo.jpg?derivative=header
https://example.com/images/photo.jpg?derivative=thumbnail
```

### Responsive Images

```
https://example.com/images/photo.jpg?width=auto
```

Uses client hints or user agent detection to serve the most appropriate size.

### Manual Size Selection

```
https://example.com/images/photo.jpg?width=800&height=600
```

Selects the closest predefined width or uses exact dimensions if specified.

### Additional Parameters

- `quality`: Override quality setting (1-100)
- `fit`: Change resize mode (crop, contain, cover, scale-down)
- `format`: Force specific format (avif, webp, etc.)

## Client Hints Setup

For best results with `width=auto`, add this to your HTML pages:

```html
<meta http-equiv="Delegate-CH" content="sec-ch-dpr https://example.com; sec-ch-viewport-width https://example.com"/>
```

Or use HTTP headers:

```
Accept-CH: Sec-CH-DPR, Sec-CH-Viewport-Width
Critical-CH: Sec-CH-DPR, Sec-CH-Viewport-Width
```

## Deployment

1. Install Wrangler:
   ```
   npm install -g wrangler
   ```

2. Authenticate:
   ```
   wrangler login
   ```

3. Deploy the worker:
   ```
   wrangler deploy
   ```

## Configuration

### Image Settings

Edit `src/config/imageConfig.js` to customize the default settings, including:

- Cache TTLs
- Image derivatives
- Quality settings
- Default widths

### Remote Buckets and Routes

Edit `src/config/environmentConfig.js` to configure:

- Remote bucket mappings
- Route-based derivative selection

Example configuration:

```javascript
export const environmentConfig = {
  // Remote bucket configuration
  remoteBuckets: {
    'remote-images': 'https://your-remote-bucket.example.com',
    'cdn-assets': 'https://your-cdn-bucket.example.com',
  },
  
  // Route configuration - automatically apply derivatives based on route
  routes: {
    'profile-pictures': 'thumbnail',
    'hero-banners': 'header',
  }
};
