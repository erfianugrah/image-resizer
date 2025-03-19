# Image Resizer Documentation

Welcome to the Image Resizer documentation. This directory contains comprehensive information about the project, its architecture, configuration, and usage.

## Getting Started

- [Installation Guide](../README.md#installation) - How to install and set up the project
- [Quick Start](../README.md#quick-start) - Get up and running quickly
- [Basic Usage](../README.md#usage) - Basic usage examples

## User Documentation

- [API.md](API.md) - Complete API reference for the Image Resizer service
- [CONFIG.md](CONFIG.md) - Configuration guide and options reference
- [TESTING.md](TESTING.md) - Guide to testing the application

## Architecture Documentation

### Core Architecture

- [ARCHITECTURE.md](architecture/ARCHITECTURE.md) - Overview of the system architecture, patterns, and components
- [DEPENDENCY_INJECTION.md](architecture/DEPENDENCY_INJECTION.md) - Implementation of the dependency injection pattern
- [TYPE_SYSTEM.md](architecture/TYPE_SYSTEM.md) - Details of the TypeScript type system organization

### Configuration and State Management

- [SINGLE_SOURCE_OF_TRUTH.md](architecture/SINGLE_SOURCE_OF_TRUTH.md) - How wrangler.jsonc serves as the single source of truth
- [CONFIGURATION.md](architecture/CONFIGURATION.md) - Comprehensive configuration system explanation

### Image Processing and Transformation

- [R2_INTEGRATION.md](architecture/R2_INTEGRATION.md) - Integration with Cloudflare R2 for image storage
- [INTERCEPTOR_STRATEGY.md](architecture/INTERCEPTOR_STRATEGY.md) - How the interceptor strategy works for optimal performance

### Infrastructure and Performance

- [CACHING.md](architecture/CACHING.md) - Comprehensive caching strategy
- [ENHANCED_DEBUG_HEADERS.md](architecture/ENHANCED_DEBUG_HEADERS.md) - Debugging infrastructure with enhanced headers

### Error Handling

- [ERROR_HANDLING.md](architecture/ERROR_HANDLING.md) - Standardized error handling system

### Project Status and Evolution

- [REFACTORING_PROGRESS.md](architecture/REFACTORING_PROGRESS.md) - Documentation of refactoring progress
- [ARCHITECTURE_IMPROVEMENTS.md](architecture/ARCHITECTURE_IMPROVEMENTS.md) - Planned and implemented architecture improvements

## Architecture Diagrams

- [Component Diagram](architecture/diagrams/component.png) - High-level component diagram
- [Sequence Diagram](architecture/diagrams/sequence.png) - Request processing sequence diagram
- [Class Diagram](architecture/diagrams/class.png) - Key classes and their relationships

## Additional Resources

- [Project README](../README.md) - Getting started guide and feature overview
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [Developer Guide](DEVELOPER.md) - Development practices and guidelines