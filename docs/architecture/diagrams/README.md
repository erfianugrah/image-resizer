# Architecture Diagrams

This directory contains architectural diagrams for the Image Resizer service, created using Mermaid.

## Diagram Types

- **Component Diagram**: Illustrates the high-level components of the system and their relationships
- **Sequence Diagram**: Shows the interaction between components during request processing
- **Class Diagram**: Displays key classes, interfaces, and their relationships

## Creating or Updating Diagrams

We use [Mermaid](https://mermaid-js.github.io/) for all architecture diagrams because:
- It's version-control friendly (text-based)
- It's directly supported in GitHub markdown
- It's easy to maintain and update
- It ensures consistency across all diagrams

## Example Diagrams

### Component Diagram

```mermaid
graph TD
    Client["Client (Browser/App)"]
    
    subgraph "Cloudflare Worker"
        Handler["Image Handler<br/>Request Handler"]
        Transform["Image Transformation<br/>Service"]
        Cache["Cache Management<br/>Service"]
        Config["Configuration<br/>Service"]
        R2Integration["R2 Integration<br/>Service"]
        
        Handler --> Transform
        Handler --> Cache
        Handler --> Config
        Transform --> R2Integration
    end
    
    R2Storage["R2 Storage<br/>Cloudflare"]
    CDN["Cloudflare CDN<br/>Image Transformations"]
    
    Client --> Handler
    R2Integration --> R2Storage
    Transform --> CDN
    
    style Client fill:#f9f,stroke:#333,stroke-width:2px
    style R2Storage fill:#bbf,stroke:#333,stroke-width:2px
    style CDN fill:#bfb,stroke:#333,stroke-width:2px
```

### Sequence Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Handler as Image Handler
    participant Transform as Image Transformation
    participant R2 as R2 Integration
    participant CDN as Cloudflare CDN
    participant R2Storage as R2 Storage
    
    Client->>Handler: Request Image
    Handler->>Transform: Transform Image
    
    alt Image in R2
        Transform->>R2: Get Original Image
        R2->>R2Storage: Fetch Object
        R2Storage-->>R2: Return Image
        R2-->>Transform: Original Image
        Transform->>CDN: Apply Transformations
        CDN-->>Transform: Transformed Image
    else Fallback
        Transform->>CDN: Get from Remote URL
        CDN-->>Transform: Transformed Image
    end
    
    Transform-->>Handler: Return Result
    Handler-->>Client: Transformed Image
```

### Class Diagram

```mermaid
classDiagram
    class IImageHandler {
        <<interface>>
        +handleRequest(request) Response
    }
    
    class ImageHandler {
        -transformService: IImageTransformationService
        -cacheService: ICacheManagementService
        +handleRequest(request) Response
    }
    
    class IImageTransformationService {
        <<interface>>
        +transformImage(options) Response
    }
    
    class ImageTransformationService {
        -strategies: IImageTransformationStrategy[]
        -r2Service: IR2ImageProcessorService
        +transformImage(options) Response
    }
    
    class IImageTransformationStrategy {
        <<interface>>
        +name: string
        +priority: number
        +canHandle(params) boolean
        +execute(params) Response
    }
    
    class InterceptorStrategy {
        +name: string
        +priority: number
        +canHandle(params) boolean
        +execute(params) Response
    }
    
    class DirectUrlStrategy {
        +name: string
        +priority: number
        +canHandle(params) boolean
        +execute(params) Response
    }
    
    IImageHandler <|.. ImageHandler
    IImageTransformationService <|.. ImageTransformationService
    IImageTransformationStrategy <|.. InterceptorStrategy
    IImageTransformationStrategy <|.. DirectUrlStrategy
    ImageHandler --> IImageTransformationService
    ImageTransformationService --> IImageTransformationStrategy
```

## Usage

1. Create your diagram in a Markdown file using the Mermaid syntax
2. Preview it in GitHub or using a Mermaid live editor (https://mermaid.live/)
3. When finalized, generate a PNG export for offline viewing
4. Store both the Markdown source and PNG in this directory
5. Update references in documentation to point to your diagram

## Best Practices

- Keep diagrams simple and focused
- Use consistent styling across all diagrams
- Update diagrams when architecture changes
- Include diagram source code in the repository
- Add comments to explain complex parts