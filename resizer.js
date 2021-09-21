addEventListener('fetch', event => {
    if (!/image-resizing/.test(event.request.headers.get("via"))) {
        return event.respondWith(handleRequest(event.request))
    }
})

async function handleRequest(request) {

let newRequest = new URL(request.url)
const customCacheKey = `${newRequest.hostname}${newRequest.pathname}${newRequest.searchParams}`
const urlParams = newRequest.searchParams

const cacheAssets = [
    { asset: 'image', key: customCacheKey, regex: /^.*\.(jpe?g|png|gif|webp)/, info: 0, ok: 31536000, redirects: 31536000, clientError: 10, serverError: 1 },
]

const imageDeviceOptions = {
    desktop: { height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 85, format: 'auto'},
    tablet: { height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 85, format: 'auto'},
    mobile: { height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 85, format: 'auto'}
}

const height = urlParams.get('height') || undefined
const width = urlParams.get('width') || undefined
const fit = urlParams.get('fit') || undefined
const quality = urlParams.get('quality') || undefined
const metadata = urlParams.get('metadata') || undefined
const format = urlParams.get('format') || undefined

const imageURLOptions = { width, height, fit, quality, metadata, format }

let subRequest = new Request(request)
subRequest.headers.append("cf-feat-tiered-cache", "image")
const device = subRequest.headers.get("cf-device-type") || "desktop"
const deviceMatch = imageDeviceOptions[device]

const { asset, regex, ...cache } = cacheAssets.find( ({regex}) => newRequest.pathname.match(regex)) ?? {}

let options = deviceMatch || {}; for (k in imageURLOptions) { 
    if (imageURLOptions[k]) options[k] = imageURLOptions[k]; 
}

const imageResizer = cache ? options : {}

let newResponse = await fetch(subRequest,
        { cf:
            {
                polish: "off",
                cacheKey: cache.key,
                cacheEverything: true,
                cacheTtlByStatus: {
                    '100-199': cache.info,
                    '200-299': cache.ok,
                    '300-399': cache.redirects,
                    '400-499': cache.clientError,
                    '500-599': cache.serverError
                    },
                image: {
                    width: imageResizer.width,
                    height: imageResizer.height,
                    fit: imageResizer.fit,
                    metadata: imageResizer.metadata,
                    quality: imageResizer.quality,
                    format: imageResizer.format
                    }
            },
        })

let response = new Response(newResponse.body, newResponse)
response.headers.set("debug-ir", JSON.stringify(imageResizer))
response.headers.set("debug-cache", JSON.stringify(cache))
response.headers.set("cache-control", "public, max-age=31536000")

const catchResponseError = response.ok || response.redirected ? response : await fetch(request)
return catchResponseError
}