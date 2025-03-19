# Image Resizer Architecture Documentation

This directory contains comprehensive documentation about the architecture, design patterns, and implementation details of the Image Resizer service.

## Core Architecture

- [ARCHITECTURE.md](ARCHITECTURE.md) - Overview of the system architecture, patterns, and components
- [DEPENDENCY_INJECTION.md](DEPENDENCY_INJECTION.md) - Implementation of the dependency injection pattern
- [TYPE_SYSTEM.md](TYPE_SYSTEM.md) - Details of the TypeScript type system organization

## Configuration and State Management

- [SINGLE_SOURCE_OF_TRUTH.md](SINGLE_SOURCE_OF_TRUTH.md) - How wrangler.jsonc serves as the single source of truth
- [CONFIGURATION.md](CONFIGURATION.md) - Comprehensive configuration system explanation

## Image Processing and Transformation

- [R2_INTEGRATION.md](R2_INTEGRATION.md) - Integration with Cloudflare R2 for image storage
- [INTERCEPTOR_STRATEGY.md](INTERCEPTOR_STRATEGY.md) - How the interceptor strategy works for optimal performance

## Infrastructure and Performance

- [CACHING.md](CACHING.md) - Comprehensive caching strategy
- [ENHANCED_DEBUG_HEADERS.md](ENHANCED_DEBUG_HEADERS.md) - Debugging infrastructure with enhanced headers

## Error Handling

- [ERROR_HANDLING.md](ERROR_HANDLING.md) - Standardized error handling system

## Project Status and Evolution

- [REFACTORING_PROGRESS.md](REFACTORING_PROGRESS.md) - Documentation of refactoring progress
- [ARCHITECTURE_IMPROVEMENTS.md](ARCHITECTURE_IMPROVEMENTS.md) - Planned and implemented architecture improvements

## Architecture Diagrams

- [diagrams/component.png](diagrams/component.png) - High-level component diagram
- [diagrams/sequence.png](diagrams/sequence.png) - Request processing sequence diagram
- [diagrams/class.png](diagrams/class.png) - Key classes and their relationships

## Document Conventions

Each architecture document follows a consistent structure:

1. **Overview**: Brief explanation of the topic and its importance
2. **Design Principles**: Key principles guiding the implementation
3. **Implementation Details**: How the concept is implemented in code
4. **Examples**: Code examples demonstrating the concept
5. **Best Practices**: Guidelines for maintaining and extending the system

For code examples, we use TypeScript syntax highlighting and include comments for clarity.