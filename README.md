# Cloudflare Image Resizing Worker

A TypeScript-based Cloudflare Worker that provides dynamic image transformation using Cloudflare's Image Resizing service. Built with a service-oriented architecture and command pattern for maintainability and extensibility.

## Features

- **Dynamic image resizing** - Resize images on-the-fly with explicit dimensions or responsive sizing
- **Format optimization** - Serve AVIF, WebP, or other formats based on browser support
- **Device detection** - Optimize image sizes for mobile, tablet, and desktop devices
- **Client hints support** - Use browser-provided information for precise sizing
- **Predefined templates** - Configure standard image transformations (thumbnails, avatars, etc.)
- **Path-based processing** - Apply transformations based on URL patterns
- **Multiple origin support** - Process images from R2 buckets, remote origins, or use multi-layered fallback
- **Flexible deployment modes** - Run in R2-only, remote-only, or hybrid mode
- **Cache optimization** - Fine-grained cache control with TTL configuration
- **Debug capabilities** - Detailed headers and logs for troubleshooting

## Image Origin Options

This worker supports multiple image origin strategies:

### R2 Integration

Access and transform images stored in Cloudflare R2 buckets:

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "hybrid", // or "r2-only"
  "ORIGIN_CONFIG": {
    "default_priority": [
      "r2",
      "remote",
      "fallback"
    ],
    "r2": {
      "enabled": true,
      "binding_name": "IMAGES_BUCKET"
    }
  }
}
```

### Remote Origin

Fetch and transform images from external origins:

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "remote",
  "REMOTE_BUCKETS": {
    "default": "https://cdn.example.com",
    "marketing": "https://marketing-assets.example.com"
  }
}
```

### Multi-layered Fallback

Configure a prioritized fallback chain:

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "hybrid",
  "ORIGIN_CONFIG": {
    "default_priority": [
      "r2",
      "remote",
      "fallback"
    ],
    "r2": {
      "enabled": true,
      "binding_name": "IMAGES_BUCKET"
    },
    "remote": {
      "enabled": true
    },
    "fallback": {
      "enabled": true,
      "url": "https://cdn.example.com"
    }
  }
}
```

## Configuration System

This project features a comprehensive configuration management system:

- **Environment-specific configurations** - Tailor settings for development, staging, and production
- **Flexible service registry** - Dependency injection with singleton, transient, and scoped lifecycles
- **R2 bucket bindings** - Seamless integration with Cloudflare R2 storage
- **Predefined Templates** - Ready-to-use configurations for image transformations
- **Enhanced Validation** - Comprehensive validation with detailed error reporting

### Core Configuration

The `wrangler.jsonc` file controls how your worker is deployed and configured:

```jsonc
{
  "name": "image-resizer",         // The name of your worker
  "main": "src/index.ts",          // Entry point TypeScript file
  "compatibility_date": "2025-01-01", // Cloudflare compatibility date
  "account_id": "YOUR_ACCOUNT_ID", // Your Cloudflare account ID
  
  // Resource limits to prevent unexpected billing
  "limits": {
    "cpu_ms": 50,                  // CPU time limit in milliseconds
    "memory_mb": 128               // Memory limit in megabytes
  },
  
  // Observability settings for monitoring
  "observability": {
    "enabled": true,               // Enable built-in monitoring
    "head_sampling_rate": 1        // Sampling rate for metrics
  },
  
  // Development server configuration
  "dev": {
    "port": 9001,                  // Local development port
    "local_protocol": "http",      // Protocol for local requests
    "upstream_protocol": "https"   // Protocol for upstream requests
  }
}
```

### Environment Configurations

The worker supports multiple deployment environments:

```jsonc
"env": {
  "dev": {
    "name": "dev-resizer",
    "r2_buckets": [
      {
        "binding": "IMAGES_BUCKET",
        "bucket_name": "images",
        "preview_bucket_name": "images-dev"
      }
    ],
    "vars": {
      "ENVIRONMENT": "development",
      "DEPLOYMENT_MODE": "hybrid",
      "VERSION": "1.1.0",
      // Additional configuration...
    }
  },
  "staging": {
    // Staging-specific configuration...
  },
  "prod": {
    // Production-specific configuration...
  }
}
```

## Step-by-Step Setup Guide

### Prerequisites

- **Cloudflare Account**: Active account with Workers, Image Resizing, and R2 enabled
- **Wrangler CLI**: [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (v3.0.0 or later)
- **Node.js**: Version 18.0.0 or later
- **TypeScript**: Familiarity with TypeScript is helpful but not required

### 1. Installation

1. Clone the repository
   ```bash
   git clone https://github.com/erfianugrah/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Verify the installation
   ```bash
   npm run typecheck
   npm test
   ```

### 2. Configuration

1. Update `wrangler.jsonc` with your Cloudflare account ID and zone IDs
2. Configure your R2 bucket bindings
3. Set appropriate route patterns for your domains
4. Customize image transformation templates as needed

### 3. Deployment

1. Development deployment:
   ```bash
   npm run dev
   ```

2. Production deployment:
   ```bash
   npm run deploy
   ```

## Deployment Modes

### R2-Only Mode

In R2-only mode, the worker exclusively uses Cloudflare R2 buckets for image storage.

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "r2-only",
  "ORIGIN_CONFIG": {
    "default_priority": ["r2"],
    "r2": {
      "enabled": true,
      "binding_name": "IMAGES_BUCKET"
    }
  }
}
```

This mode is optimal when:
- You want full control over your image assets
- You need the best performance with minimal external dependencies
- You want to leverage Cloudflare's global network while keeping assets on R2

### Remote Mode

In remote mode, the worker acts as a proxy, fetching images from remote origins.

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "remote",
  "REMOTE_BUCKETS": {
    "default": "https://cdn.example.com",
    "marketing": "https://marketing-assets.example.com"
  }
}
```

This mode is optimal when:
- Your images are hosted on external services
- You need to transform images from multiple sources
- You want to use Cloudflare as a CDN/transformer without migrating assets

### Hybrid Mode

In hybrid mode, the worker can use both R2 buckets and remote origins, with configurable fallback priority.

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "hybrid",
  "ORIGIN_CONFIG": {
    "default_priority": ["r2", "remote", "fallback"],
    "r2": {
      "enabled": true,
      "binding_name": "IMAGES_BUCKET"
    },
    "remote": {
      "enabled": true
    },
    "fallback": {
      "enabled": true,
      "url": "https://cdn.example.com"
    }
  }
}
```

This mode is optimal when:
- You're migrating from remote origins to R2
- You need maximum flexibility and resilience
- You want to balance performance with storage costs

## Usage

### Basic Image Transformations

```
# Original image
https://images.erfi.dev/sample.jpg

# Explicit width (800px)
https://images.erfi.dev/sample.jpg?width=800

# Width and height with fit=cover
https://images.erfi.dev/sample.jpg?width=800&height=600&fit=cover

# Format conversion (WebP)
https://images.erfi.dev/sample.jpg?width=800&format=webp

# Advanced transformations
https://images.erfi.dev/sample.jpg?width=800&height=400&fit=cover&sharpen=1&brightness=0.1
```

### Using Templates

Apply predefined templates in two ways:

```
# Via path-based detection
https://images.erfi.dev/thumbnail/sample.jpg

# Via explicit parameter
https://images.erfi.dev/sample.jpg?derivative=thumbnail
```

### Responsive Images

The worker supports automatic responsive image sizing using:

1. **Client Hints** - Modern browsers can provide viewport and DPR information
2. **CF-Device-Type** - Uses Cloudflare's device detection
3. **User-Agent** - Fallback device detection

Enable responsive sizing:

```
# Explicit auto mode (resizes based on device)
https://images.erfi.dev/sample.jpg?width=auto

# Default mode (when no width is specified)
https://images.erfi.dev/sample.jpg
```

### HTML Implementation

For optimal responsive image implementation:

```html
<!-- Enable client hints -->
<meta http-equiv="Accept-CH" content="DPR, Width, Viewport-Width">
<meta http-equiv="Delegate-CH" content="Sec-CH-DPR https://images.erfi.dev; Sec-CH-Width https://images.erfi.dev; Sec-CH-Viewport-Width https://images.erfi.dev">

<!-- Basic responsive image -->
<img 
  src="https://images.erfi.dev/sample.jpg?width=800" 
  srcset="
    https://images.erfi.dev/sample.jpg?width=320 320w,
    https://images.erfi.dev/sample.jpg?width=768 768w,
    https://images.erfi.dev/sample.jpg?width=1024 1024w,
    https://images.erfi.dev/sample.jpg?width=1440 1440w
  "
  sizes="(max-width: 768px) 100vw, 800px"
  alt="Sample image"
/>

<!-- Template-based image -->
<img 
  src="https://images.erfi.dev/thumbnail/sample.jpg" 
  alt="Thumbnail image"
/>

<!-- Automatic responsive sizing (no srcset needed) -->
<img 
  src="https://images.erfi.dev/sample.jpg?width=auto" 
  alt="Auto-responsive image"
/>
```

## Supported Parameters

| Parameter | Description | Values | Example |
|-----------|-------------|--------|---------|
| `width` | Image width in pixels (or "auto") | 10-8192, "auto" | `width=800` |
| `height` | Image height in pixels | 10-8192 | `height=600` |
| `fit` | Resize behavior | scale-down, contain, cover, crop, pad | `fit=cover` |
| `quality` | Compression quality | 1-100 | `quality=85` |
| `format` | Output format | auto, webp, avif, json, jpeg, png, gif | `format=webp` |
| `dpr` | Device pixel ratio | 1-5 | `dpr=2` |
| `metadata` | Metadata handling | keep, copyright, none | `metadata=none` |
| `gravity` | Focus area | auto, center, face, top, bottom, left, right | `gravity=face` |
| `sharpen` | Sharpen amount | 0-10 | `sharpen=1` |
| `brightness` | Brightness adjustment | -1 to 1 | `brightness=0.2` |
| `contrast` | Contrast adjustment | -1 to 1 | `contrast=0.1` |
| `derivative` | Template to apply | (configured templates) | `derivative=thumbnail` |

See [Cloudflare Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/url-format/) for a complete list.

## Development

### Local Development

Start a local development server:

```bash
npm run dev
```

This starts a local server at http://localhost:9001 that simulates the Cloudflare Workers environment.

### Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage reporting:

```bash
npm run test:coverage
```

### TypeScript Validation

Check TypeScript correctness:

```bash
npm run typecheck
```

### Linting

Check code quality:

```bash
npm run lint
```

Automatically fix linting issues:

```bash
npm run lint:fix
```

## Project Architecture

The project uses a service-oriented architecture with domain-driven design principles and dependency injection:

### Directory Structure

```
├── docs/                         # Documentation
│   ├── CONFIG.md                 # Configuration guide
│   ├── API.md                    # API documentation
│   └── architecture/             # Architecture documentation
│       ├── ARCHITECTURE.md       # Overall architecture
│       ├── DEPENDENCY_INJECTION.md # DI implementation
│       ├── ERROR_HANDLING.md     # Error handling patterns
│       └── TYPE_SYSTEM.md        # TypeScript type organization
├── src/
│   ├── index.ts                  # Main entry point
│   ├── config/                   # Configuration management
│   │   ├── configManager.ts      # Configuration management
│   │   ├── configValidator.ts    # Configuration validation
│   │   └── imageConfig.ts        # Image config schemas
│   ├── core/                     # Core infrastructure
│   │   ├── logger.ts             # Logging system
│   │   └── serviceRegistry.ts    # Dependency injection
│   ├── domain/                   # Domain model
│   │   └── commands/             # Command pattern implementations
│   │       └── TransformImageCommand.ts # Image transformation
│   ├── handlers/                 # Request handlers
│   │   ├── imageHandler.ts       # Main request handler
│   │   └── imageOptionsService.ts # Options determination
│   ├── services/                 # Business services
│   │   ├── cacheManagementService.ts # Cache management
│   │   ├── debugService.ts       # Debug functionality
│   │   └── imageTransformationService.ts # Image transformation
│   ├── types/                    # TypeScript type definitions
│   │   ├── core/                 # Core type definitions
│   │   ├── services/             # Service interface definitions
│   │   └── utils/                # Utility type definitions
│   └── utils/                    # Utilities
│       ├── cacheUtils.ts         # Cache utilities
│       ├── clientHints.ts        # Client hints processing
│       ├── formatUtils.ts        # Format detection
│       ├── pathUtils.ts          # Path processing
│       └── urlTransformUtils.ts  # URL transformation
```

### Dependency Injection

The project uses a service registry pattern for dependency injection:

- **Service Registration**: Services are registered with a lifecycle (singleton, transient, scoped)
- **Factory Functions**: Services are created through factory functions with explicit dependencies
- **Interface-Based Design**: Services implement interfaces to provide clear contracts
- **Service Resolution**: The registry resolves dependencies at runtime

Example service registration:

```typescript
// Register a service
serviceRegistry.register<IImageTransformationService>('IImageTransformationService', {
  factory: (deps) => createImageTransformationService(deps),
  lifecycle: 'singleton',
  dependencies: ['IConfigManager', 'ILogger']
});

// Resolve a service
const imageService = serviceRegistry.resolve<IImageTransformationService>('IImageTransformationService');
```

For more details on the architecture, see [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md).

## License

This project is licensed under the MIT License - see the LICENSE file for details.