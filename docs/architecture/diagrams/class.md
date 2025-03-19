# Class Diagram

This diagram shows the key classes and interfaces in the Image Resizer service and their relationships.

```mermaid
classDiagram
    %% Core Interfaces
    class IImageHandler {
        <<interface>>
        +handleRequest(request: Request) Promise~Response~
    }
    
    class IImageTransformationService {
        <<interface>>
        +transformImage(options: ImageTransformOptions, request: Request) Promise~Response~
    }
    
    class IImageTransformationStrategy {
        <<interface>>
        +name: string
        +priority: number
        +canHandle(params: TransformationStrategyParams) boolean
        +execute(params: TransformationStrategyParams) Promise~Response~
    }
    
    class IR2ImageProcessorService {
        <<interface>>
        +processR2Image(key: string, bucket: R2Bucket, options: ImageTransformOptions, request: Request) Promise~Response~
    }
    
    class IEnvironmentService {
        <<interface>>
        +getDomain(url: string | URL) string
        +isWorkersDevDomain(domain: string) boolean
        +isCustomDomain(domain: string) boolean
        +getEnvironmentForDomain(domain: string) EnvironmentType
        +getRouteConfigForUrl(url: string | URL) RouteConfig
        +getStrategyPriorityOrderForUrl(url: string | URL) string[]
        +isStrategyEnabledForUrl(strategyName: string, url: string | URL) boolean
    }
    
    class IConfigurationService {
        <<interface>>
        +getStrategyConfig() StrategyConfig
        +get(path: string, defaultValue?: any) any
    }
    
    class IServiceRegistry {
        <<interface>>
        +register(name: string, registration: ServiceRegistration) void
        +resolve<T>(name: string) T
        +isRegistered(name: string) boolean
        +createScope() string
        +disposeScope(scopeId: string) void
    }
    
    %% Implementations
    class ImageHandler {
        -transformService: IImageTransformationService
        -cacheService: ICacheManagementService
        -configService: IConfigurationService
        +handleRequest(request: Request) Promise~Response~
        -parseImageOptions(url: URL) ImageTransformOptions
    }
    
    class ImageTransformationService {
        -strategies: IImageTransformationStrategy[]
        -r2Service: IR2ImageProcessorService
        -environmentService: IEnvironmentService
        +transformImage(options: ImageTransformOptions, request: Request) Promise~Response~
        -selectStrategiesForDomain(domain: string) IImageTransformationStrategy[]
    }
    
    class StreamingTransformationService {
        -strategies: IImageTransformationStrategy[]
        -cache: ICacheService
        -environmentService: IEnvironmentService
        +processR2Image(key: string, bucket: R2Bucket, options: ImageTransformOptions) Promise~Response~
        +registerStrategy(strategy: IImageTransformationStrategy) void
        +getStrategies() IImageTransformationStrategy[]
    }
    
    class EnvironmentService {
        -logger: ILogger
        -configService: IConfigurationService
        +getDomain(url: string | URL) string
        +isWorkersDevDomain(domain: string) boolean
        +isCustomDomain(domain: string) boolean
        +getEnvironmentForDomain(domain: string) EnvironmentType
        +getRouteConfigForUrl(url: string | URL) RouteConfig
        +getStrategyPriorityOrderForUrl(url: string | URL) string[]
        +isStrategyEnabledForUrl(strategyName: string, url: string | URL) boolean
    }
    
    class ConfigurationService {
        -logger: ILogger
        -env: Record~string, any~
        +getStrategyConfig() StrategyConfig
        +get(path: string, defaultValue?: any) any
    }
    
    class ServiceRegistry {
        -registrations: Map~string, ServiceRegistration~
        -instances: Map~string, any~
        -scopes: Map~string, Map~string, any~~
        +register(name: string, registration: ServiceRegistration) void
        +resolve<T>(name: string) T
        +isRegistered(name: string) boolean
        +createScope() string
        +disposeScope(scopeId: string) void
    }
    
    %% Strategy Implementations
    class InterceptorStrategy {
        +name: string = "interceptor"
        +priority: number = 0
        +canHandle(params: TransformationStrategyParams) boolean
        +execute(params: TransformationStrategyParams) Promise~Response~
    }
    
    class DirectUrlStrategy {
        +name: string = "direct-url"
        +priority: number = 2
        +canHandle(params: TransformationStrategyParams) boolean
        +execute(params: TransformationStrategyParams) Promise~Response~
    }
    
    class DirectServingStrategy {
        +name: string = "direct-serving"
        +priority: number = 10
        +canHandle(params: TransformationStrategyParams) boolean
        +execute(params: TransformationStrategyParams) Promise~Response~
    }
    
    class RemoteFallbackStrategy {
        +name: string = "remote-fallback"
        +priority: number = 3
        +canHandle(params: TransformationStrategyParams) boolean
        +execute(params: TransformationStrategyParams) Promise~Response~
    }
    
    %% Relationships
    IImageHandler <|.. ImageHandler
    IImageTransformationService <|.. ImageTransformationService
    IR2ImageProcessorService <|.. StreamingTransformationService
    IEnvironmentService <|.. EnvironmentService
    IConfigurationService <|.. ConfigurationService
    IServiceRegistry <|.. ServiceRegistry
    
    IImageTransformationStrategy <|.. InterceptorStrategy
    IImageTransformationStrategy <|.. DirectUrlStrategy
    IImageTransformationStrategy <|.. DirectServingStrategy
    IImageTransformationStrategy <|.. RemoteFallbackStrategy
    
    ImageHandler --> IImageTransformationService
    ImageHandler --> IConfigurationService
    ImageTransformationService --> IImageTransformationStrategy
    ImageTransformationService --> IR2ImageProcessorService
    ImageTransformationService --> IEnvironmentService
    StreamingTransformationService --> IImageTransformationStrategy
    EnvironmentService --> IConfigurationService
```

## Class and Interface Descriptions

### Interfaces

- **IImageHandler**: Primary interface for handling image requests
- **IImageTransformationService**: Manages image transformation operations
- **IImageTransformationStrategy**: Strategy pattern interface for different transformation approaches
- **IR2ImageProcessorService**: Handles interaction with R2 storage for image processing
- **IEnvironmentService**: Provides environment and domain-specific configuration
- **IConfigurationService**: Accesses configuration from wrangler.jsonc
- **IServiceRegistry**: Manages service registration and dependency injection

### Implementations

- **ImageHandler**: Main request handler for image processing
- **ImageTransformationService**: Orchestrates image transformation using multiple strategies
- **StreamingTransformationService**: Implements R2 image processing with streaming
- **EnvironmentService**: Provides domain-specific configuration based on URL patterns
- **ConfigurationService**: Manages access to wrangler.jsonc configuration
- **ServiceRegistry**: Implements dependency injection container

### Strategies

- **InterceptorStrategy**: Uses cf.image with subrequest interception (custom domains)
- **DirectUrlStrategy**: Uses direct URLs with cf.image properties (all domains)
- **DirectServingStrategy**: Serves images directly without transformation
- **RemoteFallbackStrategy**: Falls back to remote URLs when other methods fail