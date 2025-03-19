# Image Resizer Documentation Index

This index provides a comprehensive overview of all documentation available for the Image Resizer project.

## Getting Started

- [Installation Guide](../README.md#installation)
- [Quick Start](../README.md#quick-start)
- [Basic Usage](../README.md#usage)

## User Documentation

- [API Reference](API.md) - Complete API reference including endpoints and parameters
- [Configuration Guide](CONFIG.md) - Guide to configuring the Image Resizer
- [Testing Guide](TESTING.md) - How to test the application

## Architecture Documentation

### Core Architecture

- [Architecture Overview](architecture/ARCHITECTURE.md) - High-level system architecture
- [Dependency Injection](architecture/DEPENDENCY_INJECTION.md) - Factory pattern implementation
- [Type System](architecture/TYPE_SYSTEM.md) - TypeScript type organization

### Configuration System

- [Single Source of Truth](architecture/SINGLE_SOURCE_OF_TRUTH.md) - wrangler.jsonc as configuration source
- [Configuration System](architecture/CONFIGURATION.md) - How configuration works

### Image Processing

- [R2 Integration](architecture/R2_INTEGRATION.md) - Integration with Cloudflare R2
- [Interceptor Strategy](architecture/INTERCEPTOR_STRATEGY.md) - How the interceptor strategy works
- [Domain-Specific Strategies](architecture/DOMAIN_SPECIFIC_STRATEGY.md) - Strategy selection for different domains

### Performance and Infrastructure

- [Caching Strategy](architecture/CACHING.md) - How caching is implemented
- [Debug Headers](architecture/ENHANCED_DEBUG_HEADERS.md) - Using enhanced debug headers

### Error Handling

- [Error Handling](architecture/ERROR_HANDLING.md) - Standardized error handling system

### Project Status

- [Refactoring Progress](architecture/REFACTORING_PROGRESS.md) - Status of refactoring efforts
- [Architecture Improvements](architecture/ARCHITECTURE_IMPROVEMENTS.md) - Planned improvements

## Architecture Diagrams

- [Component Diagram](architecture/diagrams/component.md) - High-level component diagram
- [Sequence Diagram](architecture/diagrams/sequence.md) - Request processing sequence
- [Class Diagram](architecture/diagrams/class.md) - Key classes and their relationships

## Development

- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [Developer Guide](DEVELOPER.md) - Development practices and guidelines
- [Coding Standards](CODING_STANDARDS.md) - Code style and standards

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Image Resizing Documentation](https://developers.cloudflare.com/images/)

## Document Conventions

All documentation follows these conventions:

1. Markdown formatting with GitHub Flavored Markdown
2. Code examples in TypeScript with syntax highlighting
3. Diagrams created with Mermaid
4. Examples include both successful and error scenarios
5. Configuration examples match wrangler.jsonc structure

## Documentation Roadmap

Future documentation improvements planned:

1. Complete API reference with OpenAPI specification
2. Performance benchmarks and optimization guide
3. Advanced configuration scenarios
4. Integration examples with popular frameworks
5. Video tutorials for common operations