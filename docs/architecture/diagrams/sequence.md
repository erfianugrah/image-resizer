# Sequence Diagram

This diagram illustrates the sequence of interactions when processing an image transformation request.

```mermaid
sequenceDiagram
    participant Client
    participant Handler as Image Handler
    participant Config as Configuration Service
    participant Env as Environment Service
    participant Transform as Transformation Service
    participant Registry as Strategy Registry
    participant Strategy as Selected Strategy
    participant R2 as R2 Integration
    participant CDN as Cloudflare CDN
    participant R2Storage as R2 Storage
    
    Client->>Handler: Request Image
    Handler->>Config: Get Configuration
    Config-->>Handler: Configuration
    Handler->>Env: Get Domain Environment
    Env-->>Handler: Environment Configuration
    Handler->>Transform: Transform Image
    
    Transform->>Registry: Get Strategies for Domain
    Registry->>Env: Get Strategy Configuration
    Env-->>Registry: Domain-Specific Strategies
    Registry-->>Transform: Prioritized Strategies
    
    loop For each strategy until success
        Transform->>Strategy: Try Strategy
        
        alt Strategy = Interceptor (Custom Domains)
            Strategy->>CDN: Transform with cf.image
            CDN->>R2: Get Original via Subrequest
            R2->>R2Storage: Fetch Object
            R2Storage-->>R2: Return Image
            R2-->>CDN: Original Image
            CDN-->>Strategy: Transformed Image
            
        else Strategy = Direct URL (Workers.dev)
            Strategy->>CDN: Transform with direct URL
            CDN->>R2: Get Original Image
            R2->>R2Storage: Fetch Object
            R2Storage-->>R2: Return Image
            R2-->>CDN: Original Image
            CDN-->>Strategy: Transformed Image
            
        else Strategy = Remote Fallback
            Strategy->>CDN: Get from Remote URL
            CDN-->>Strategy: Transformed Image
        end
        
        Strategy-->>Transform: Result (Success/Failure)
    end
    
    Transform-->>Handler: Transformed Response
    Handler->>Handler: Add Cache Headers
    Handler-->>Client: Transformed Image with Headers
```

## Sequence Description

1. **Request Initiation**:
   - Client makes a request for an image with transformation parameters
   - Image Handler processes the request and retrieves configuration

2. **Environment Detection**:
   - Environment Service identifies the domain type (workers.dev vs custom)
   - Strategy configuration is determined based on domain

3. **Strategy Selection**:
   - Strategy Registry provides prioritized strategies for the domain
   - Transformation Service attempts strategies in priority order

4. **Strategy Execution**:
   - For custom domains: Interceptor strategy using cf.image with subrequests
   - For workers.dev domains: Direct URL strategy with cf.image properties
   - Fallback to remote URL if all else fails

5. **Response Processing**:
   - Cache headers and debug information added
   - Transformed image returned to client