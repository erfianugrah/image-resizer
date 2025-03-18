# Image Resizer Tests

This directory contains the tests for the Image Resizer application, focusing on ensuring the reliability of the R2 integration with Cloudflare Image Resizing.

## Test Structure

Tests are organized into the following categories:

1. **Unit Tests**: For individual functions and components
2. **Integration Tests**: For component interactions
3. **Functional Tests**: For complete features and user scenarios
4. **Environmental Tests**: For different deployment configurations

## Test Files

### Domain Tests
- `test/domain/commands/TransformImageCommand.test.ts` - Base image transformation tests
- `test/domain/commands/r2TransformImageCommand.test.ts` - R2-specific transformation tests

### Handler Tests
- `test/handlers/imageHandler.test.ts` - Main request entry point tests with R2 integration

### Service Tests
- `test/services/debugService.test.ts` - Debug service tests
- `test/services/cacheManagementService.test.ts` - Cache management tests
- `test/services/imageTransformationService.test.ts` - Image transformation service tests

### Utility Tests
- `test/utils/clientDetectionUtils.test.ts` - Client detection utility tests
- `test/utils/formatUtils.test.ts` - Format utility tests
- `test/utils/optionsFactory.test.ts` - Option generation tests
- `test/utils/pathUtils.test.ts` - Path utility tests
- `test/utils/urlParamUtils.test.ts` - URL parameter extraction and processing tests
- `test/utils/urlTransformUtils.test.ts` - URL transformation tests with R2 support
- `test/utils/validationUtils.test.ts` - Validation utility tests
- `test/utils/cacheUtils.test.ts` - Cache utility tests with R2 caching support

### Config Tests
- `test/config/configManager.test.ts` - Configuration loading tests
- `test/config/configValidator.test.ts` - Configuration validation tests

### End-to-End Tests
- `test/index.test.ts` - Worker endpoint tests

## Testing R2 Integration

The R2 integration tests use a multi-layered approach:

1. **Mock R2 Objects**: Creates `MockR2Object` class with the minimum interface needed
2. **Fetch Mocking**: Simulates Cloudflare Image Resizing with appropriate headers
3. **Service Mocking**: Properly handles the service dependencies
4. **Environment Configuration**: Tests different deployment modes and bucket configurations

## Running Tests

To run all tests:
```
npm test
```

To run a specific test file:
```
npm test -- test/utils/cacheUtils.test.ts
```

To run tests matching a pattern:
```
npm test -- -t "R2"
```

## Test Coverage

The test suite covers:
- URL transformation with R2 configuration
- R2 bucket integration and object handling
- Cache management for R2 objects
- URL parameter handling for R2 buckets and pathnames
- Full request lifecycle with R2 buckets
- Error handling and fallbacks
- Different deployment modes (hybrid, r2-only, remote-only)
- Custom R2 bucket binding configurations

## Future Test Areas

Areas for future test expansion:
- ImageOptionsService tests with R2 paths
- R2 Bucket integration functional tests
- CDN-CGI pattern tests for URL transformations
- ServiceRegistry tests for dependency injection