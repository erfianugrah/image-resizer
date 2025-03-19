# Component Diagram

This diagram shows the high-level components of the Image Resizer service and their relationships.

```mermaid
graph TD
    Client["Client (Browser/App)"]
    
    subgraph "Cloudflare Worker"
        Handler["Image Handler<br/>Request Handler"]
        Transform["Image Transformation<br/>Service"]
        Cache["Cache Management<br/>Service"]
        Config["Configuration<br/>Service"]
        R2Integration["R2 Integration<br/>Service"]
        StrategyRegistry["Strategy Registry"]
        EnvService["Environment Service"]
        
        Handler --> Transform
        Handler --> Cache
        Handler --> Config
        Transform --> R2Integration
        Transform --> StrategyRegistry
        StrategyRegistry --> EnvService
        EnvService --> Config
    end
    
    R2Storage["R2 Storage<br/>Cloudflare"]
    CDN["Cloudflare CDN<br/>Image Transformations"]
    RemoteStorage["Remote Storage<br/>Fallback"]
    
    Client --> Handler
    R2Integration --> R2Storage
    Transform --> CDN
    Transform -.-> RemoteStorage
    
    style Client fill:#f9f,stroke:#333,stroke-width:2px
    style R2Storage fill:#bbf,stroke:#333,stroke-width:2px
    style CDN fill:#bfb,stroke:#333,stroke-width:2px
    style RemoteStorage fill:#fbb,stroke:#333,stroke-width:2px
```

## Component Descriptions

### External Components

- **Client**: Web browsers or applications requesting transformed images
- **R2 Storage**: Cloudflare R2 object storage containing original images
- **Cloudflare CDN**: Provides image transformation capabilities via cf.image
- **Remote Storage**: External HTTP source for images when not available in R2

### Internal Components

- **Image Handler**: Main entry point for image requests, routes to appropriate services
- **Image Transformation Service**: Orchestrates image transformation using multiple strategies
- **Cache Management Service**: Handles caching policies and headers
- **Configuration Service**: Provides access to configuration values from wrangler.jsonc
- **R2 Integration Service**: Interacts with Cloudflare R2 storage
- **Strategy Registry**: Manages and prioritizes transformation strategies
- **Environment Service**: Provides environment-specific configuration based on domain