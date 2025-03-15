# Image Resizer API Documentation

![API Version](https://img.shields.io/badge/API%20Version-2.0-blue)
![Last Updated](https://img.shields.io/badge/Updated-March%202025-green)

This document provides a comprehensive reference for the Image Resizer API endpoints and parameters.

## Table of Contents

1. [URL Format](#url-format)
2. [Query Parameters](#query-parameters)
3. [Path-Based Transformations](#path-based-transformations)
4. [Derivatives](#derivatives)
5. [Response Headers](#response-headers)
6. [Error Handling](#error-handling)
7. [Examples](#examples)
8. [Client Hints Integration](#client-hints-integration)

## URL Format

The Image Resizer supports two main URL formats:

### Direct Request Format

```
https://[your-domain]/[path-to-image]?[transformation-parameters]
```

Example:
```
https://images.example.com/photos/landscape.jpg?width=800&height=600&fit=cover
```

### Path-Based Format

```
https://[your-domain]/[derivative-name]/[path-to-image]
```

Example:
```
https://images.example.com/thumbnail/photos/landscape.jpg
```

## Query Parameters

The following parameters can be used to control image transformations:

### Basic Dimensions

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `width` | Image width in pixels | 10-8192, "auto" | Defined by responsive config | `width=800` |
| `height` | Image height in pixels | 10-8192 | Maintains aspect ratio | `height=600` |
| `dpr` | Device pixel ratio | 1-5 | 1 | `dpr=2` |

### Format Options

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `format` | Output image format | auto, webp, avif, jpeg, png, gif | auto | `format=webp` |
| `quality` | Compression quality | 1-100 | 85 | `quality=90` |
| `compress` | Compression level | true, false | true | `compress=false` |
| `metadata` | Metadata handling | keep, copyright, none | copyright | `metadata=none` |

### Sizing & Positioning

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `fit` | Resize behavior | scale-down, contain, cover, crop, pad | scale-down | `fit=cover` |
| `gravity` | Focus area | auto, center, face, top, bottom, left, right | auto | `gravity=face` |
| `background` | Background color for transparent images | Hex color | white | `background=000000` |

### Image Enhancements

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `sharpen` | Sharpen amount | 0-10 | 0 | `sharpen=1` |
| `blur` | Blur radius | 0-250 | 0 | `blur=5` |
| `brightness` | Brightness adjustment | -1 to 1 | 0 | `brightness=0.2` |
| `contrast` | Contrast adjustment | -1 to 1 | 0 | `contrast=0.1` |
| `saturation` | Saturation adjustment | -1 to 1 | 0 | `saturation=0.3` |

### Derivative & Template

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `derivative` | Preset template to apply | (configured templates) | none | `derivative=thumbnail` |

### Debug Options

| Parameter | Description | Values | Default | Example |
|-----------|-------------|--------|---------|---------|
| `debug` | Enable debug headers | true, false | false | `debug=true` |
| `explain` | Show transformation explanation | true, false | false | `explain=true` |

## Path-Based Transformations

The Image Resizer can transform URLs based on path segments. This is configured in the `PATH_TEMPLATES` setting:

```json
"PATH_TEMPLATES": {
  "thumbnails": "thumbnail",
  "avatars": "avatar",
  "products": "product"
}
```

When a URL contains a matching path segment, the corresponding derivative is automatically applied:

```
https://images.example.com/thumbnails/user/photo.jpg
```

This applies the "thumbnail" derivative to the image.

## Derivatives

Derivatives are predefined sets of transformation parameters that can be applied by name.

### Built-in Derivatives

The Image Resizer includes several built-in derivatives depending on the template you're using:

#### Basic Template

| Derivative | Description | Parameters | Example Usage |
|------------|-------------|------------|--------------|
| `thumbnail` | Small image for listings | width=320, height=180, fit=scale-down | `?derivative=thumbnail` |
| `medium` | Medium size for content | width=800, height=450, fit=scale-down | `?derivative=medium` |

#### E-commerce Template

| Derivative | Description | Parameters | Example Usage |
|------------|-------------|------------|--------------|
| `thumbnail` | Product thumbnail | width=200, height=200, fit=cover | `?derivative=thumbnail` |
| `product` | Main product image | width=800, height=800, fit=contain | `?derivative=product` |
| `zoom` | High-quality zoom view | width=1600, height=1600, quality=90 | `?derivative=zoom` |
| `banner` | Category banner | width=1200, height=400, fit=cover | `?derivative=banner` |

#### Blog/Content Template

| Derivative | Description | Parameters | Example Usage |
|------------|-------------|------------|--------------|
| `thumbnail` | Article thumbnail | width=320, height=180, fit=crop | `?derivative=thumbnail` |
| `featured` | Featured/social image | width=1200, height=630, fit=crop | `?derivative=featured` |
| `inline` | Inline content image | width=800, fit=scale-down | `?derivative=inline` |
| `avatar` | User avatar | width=100, height=100, fit=cover, gravity=face | `?derivative=avatar` |

### Custom Derivatives

You can define custom derivatives in your configuration:

```json
"DERIVATIVE_TEMPLATES": {
  "hero": {
    "width": 1920,
    "height": 1080,
    "quality": 90,
    "fit": "cover",
    "gravity": "auto",
    "metadata": "none"
  }
}
```

## Response Headers

The Image Resizer sets several response headers:

### Standard Headers

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | MIME type of the image | `image/webp` |
| `Content-Length` | Size of the image in bytes | `24681` |
| `Cache-Control` | Caching directives | `public, max-age=86400` |
| `ETag` | Entity tag for caching | `"bfc13a64729c4290ef5b2c2730249c88"` |
| `Last-Modified` | When the image was last modified | `Wed, 21 Feb 2025 07:28:00 GMT` |

### Debug Headers

When debug mode is enabled, these headers are added:

| Header | Description | Example |
|--------|-------------|---------|
| `debug-ir` | Image resizing parameters | `{"width":800,"height":600,"fit":"cover"}` |
| `debug-cache` | Cache settings applied | `{"ttl":86400,"cacheability":true}` |
| `debug-mode` | Processing mode information | `{"deploymentMode":"remote"}` |
| `debug-client-hints` | Client hints information | `{"dpr":"2","viewportWidth":"1200"}` |
| `debug-ua` | User-Agent information | `{"browser":"chrome","device":"desktop"}` |

### Client Hints Headers

The Image Resizer sets these client hints-related headers:

| Header | Description | Example |
|--------|-------------|---------|
| `Accept-CH` | Accepted client hints | `DPR, Width, Viewport-Width` |
| `Critical-CH` | Critical client hints | `DPR, Width` |
| `Permissions-Policy` | Client hints permissions | `ch-dpr=(self "https://images.example.com")` |

## Error Handling

The Image Resizer returns standard HTTP status codes:

| Status Code | Description | Possible Causes |
|-------------|-------------|----------------|
| 400 | Bad Request | Invalid parameters, unsupported format |
| 404 | Not Found | Image not found, invalid path |
| 413 | Payload Too Large | Source image too large |
| 415 | Unsupported Media Type | Unsupported image format |
| 422 | Unprocessable Entity | Image corrupt or invalid |
| 500 | Internal Server Error | Server-side error |
| 502 | Bad Gateway | Origin server error |
| 504 | Gateway Timeout | Origin server timeout |

Error responses include debug headers when enabled.

## Examples

### Basic Transformations

Resize to specific dimensions:

![Resized Image](https://images.erfi.dev/Granna_1.JPG?width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?width=800&height=600
```

Resize and convert format:

![WebP Format](https://images.erfi.dev/Granna_1.JPG?width=800&format=webp)
```
https://images.erfi.dev/Granna_1.JPG?width=800&format=webp
```

Resize with a specific fit:

![Cover Fit](https://images.erfi.dev/Granna_1.JPG?width=800&height=800&fit=cover)
```
https://images.erfi.dev/Granna_1.JPG?width=800&height=800&fit=cover
```

Apply image enhancements:

![Enhanced Image](https://images.erfi.dev/Granna_1.JPG?width=800&sharpen=1&brightness=0.1&contrast=0.1)
```
https://images.erfi.dev/Granna_1.JPG?width=800&sharpen=1&brightness=0.1&contrast=0.1
```

### Using Derivatives

Apply the "thumbnail" derivative:

![Thumbnail Derivative](https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail)
```
https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail
```

Or use the path-based approach:

![Path-based Thumbnail](https://images.erfi.dev/thumbnail/Granna_1.JPG)
```
https://images.erfi.dev/thumbnail/Granna_1.JPG
```

### Responsive Images

Automatic responsive sizing:

![Auto Width](https://images.erfi.dev/Granna_1.JPG?width=auto)
```
https://images.erfi.dev/Granna_1.JPG?width=auto
```

Responsive with format conversion:

![Auto Format](https://images.erfi.dev/Granna_1.JPG?width=auto&format=auto)
```
https://images.erfi.dev/Granna_1.JPG?width=auto&format=auto
```

## Client Hints Integration

The Image Resizer supports [Client Hints](https://developer.mozilla.org/en-US/docs/Web/HTTP/Client_hints) for optimal responsive image delivery.

### Required HTML Meta Tags

Add these meta tags to your HTML to enable client hints:

```html
<meta http-equiv="Accept-CH" content="DPR, Width, Viewport-Width">
<meta http-equiv="Delegate-CH" content="Sec-CH-DPR https://images.erfi.dev; Sec-CH-Width https://images.erfi.dev; Sec-CH-Viewport-Width https://images.erfi.dev">
```

### Using Client Hints with the Image Resizer

When client hints are enabled, the Image Resizer will:

1. Detect the user's device DPR (device pixel ratio)
2. Consider the user's viewport width
3. Select an appropriate image size based on these hints
4. Return an optimally sized image

For best results, use the `width=auto` parameter:

```html
<img src="https://images.erfi.dev/Granna_1.JPG?width=auto" alt="Responsive image">
```

![Responsive Image](https://images.erfi.dev/Granna_1.JPG?width=auto)

### Fallback Behavior

When client hints are not available, the Image Resizer falls back to:

1. Cloudflare-provided device type information
2. User-Agent-based device detection
3. Default sizes defined in your responsive configuration

## Advanced Usage

### Chaining Transformations

You can chain multiple transformations:

![Chained Transformations](https://images.erfi.dev/Granna_1.JPG?width=800&format=webp&quality=90&sharpen=1)
```
https://images.erfi.dev/Granna_1.JPG?width=800&format=webp&quality=90&sharpen=1
```

### Conditional Transformations

Apply transformations based on query parameters:

```
https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail&quality=if(dpr>1,85,75)
```

### URL Parameter API

The full API for URL parameters can be found in the [Cloudflare Image Resizing documentation](https://developers.cloudflare.com/images/transform-images/).

## Need Help?

If you have questions about the API or need assistance:

1. Check the [GitHub repository](https://github.com/erfianugrah/image-resizer) for issues and discussions
2. Review the [Configuration Guide](./CONFIG.md) for setup details
3. Enable debug mode to get detailed headers: `?debug=true`
