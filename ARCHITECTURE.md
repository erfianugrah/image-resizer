# Image Resizer Architecture

This document outlines the architecture of the image-resizer service, a Cloudflare Worker that optimizes images using Cloudflare's Image Resizing service.

## Table of Contents
- [Overview](#overview)
- [Architectural Patterns](#architectural-patterns)
- [Component Structure](#component-structure)
- [Configuration Management](#configuration-management)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)

## Overview

The image-resizer is a Cloudflare Worker that intercepts image requests and applies transformations using Cloudflare's Image Resizing service. It supports:

- Responsive image sizing based on device type and client hints
- Multiple image formats (WebP, AVIF, JPEG, PNG, etc.)
- Predefined transformation templates (called "derivatives")
- Path-based derivative detection
- Caching strategies
- Debugging capabilities

## Architectural Patterns

The codebase follows several architectural patterns:

### Domain-Driven Design (DDD)

- **Domain Model**: The core business logic is encapsulated in the `domain` directory
- **Commands**: Uses command pattern (e.g., `TransformImageCommand`) to encapsulate operations

### Service-Oriented Architecture

- **Services**: Functionality is organized into services like `imageTransformationService` and `cacheManagementService`
- **Handlers**: Request processing is managed by handlers that coordinate between services

### Strategy Pattern

- **OptionsFactory**: Uses strategies to determine how to create image transformation options
- **Derivatives**: Template-based strategies for common transformations

### Factory Pattern

- **OptionsFactory**: Centralizes creation of image options
- **Strategies**: Different strategies for creating options based on context

### Singleton Pattern

- **ConfigurationManager**: Ensures single source of truth for configuration

## Component Structure

The codebase is organized into the following directories:

```
src/
├── config/             # Configuration management
├── domain/             # Domain model and commands
│   └── commands/       # Command pattern implementations
├── handlers/           # Request handlers
├── services/           # Service implementations
└── utils/              # Utility functions
```

### Key Components

#### Entry Point

- `index.ts`: The worker entry point that routes requests

#### Configuration

- `configManager.ts`: Centralized configuration management
- `imageConfig.ts`: Image-specific configuration

#### Domain Logic

- `TransformImageCommand.ts`: Implementation of the transform operation

#### Services

- `imageTransformationService.ts`: Handles image transformation
- `cacheManagementService.ts`: Manages caching
- `debugService.ts`: Provides debugging capabilities

#### Handlers

- `imageHandler.ts`: Main handler for image requests
- `imageOptionsService.ts`: Determines transformation options

#### Utilities

- `optionsFactory.ts`: Creates image options using strategy pattern
- `pathUtils.ts`: Path-related utilities
- `formatUtils.ts`: Format detection and conversion
- `urlParamUtils.ts`: URL parameter extraction

## Configuration Management

Configuration is managed through a singleton `ConfigurationManager` class that:

1. Loads configuration from environment variables
2. Provides a centralized access point for all configuration
3. Handles parsing of complex configuration objects
4. Provides reasonable defaults when configuration is missing

Configuration sources include:
- Environment variables from wrangler.jsonc
- Derivative templates
- Path patterns
- Responsive configuration
- Caching configuration

## Testing Strategy

The testing approach includes:

- **Unit Tests**: Testing individual components in isolation
- **Integration Tests**: Testing interaction between components
- **Factory Tests**: Ensuring factories create the correct objects
- **Configuration Tests**: Verifying configuration parsing
- **Strategy Tests**: Testing different strategies for image options

Test coverage is measured and maintained using Vitest.

## Deployment

The service is deployed as a Cloudflare Worker using Wrangler:

- Development: `npm run dev` or `wrangler dev`
- Staging: `npm run deploy -- --env staging`
- Production: `npm run deploy -- --env prod`

Configuration for different environments is managed in the `wrangler.jsonc` file.

## Code Quality

Code quality is maintained through:

- TypeScript for type safety
- ESLint for code quality
- Prettier for consistent formatting
- Comprehensive testing with Vitest
- CodeQL for security analysis
- Clear separation of concerns
- Performance monitoring
