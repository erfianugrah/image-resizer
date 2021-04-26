addEventListener('fetch', event => {
    if (!/image-resizing/.test(event.request.headers.get("via"))) {
        return event.respondWith(handleRequest(event.request))
    }
})

async function handleRequest(request) {

const newRequest = new URL(request.url)
const customCacheKey = newRequest.hostname + newRequest.pathname + newRequest.search
const urlParams = newRequest.searchParams

const cacheAssets = [
    { asset: 'image', key: customCacheKey, regex: /^.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm)/, info: 0, ok: -1, redirects: 30, clientError: 10, serverError: 0 },
]

const imageDeviceOptions = {
    desktop: { height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 85 },
    tablet: { height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 85 },
    mobile: { height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 85 }
}

const height = urlParams.get('height') || undefined
const width = urlParams.get('width') || undefined
const fit = urlParams.get('fit') || undefined
const quality = urlParams.get('quality') || undefined
const metadata = urlParams.get('metadata') || undefined

const imageURLOptions = { width, height, fit, quality, metadata }

const subRequest = new Request(request)
const device = subRequest.headers.get('cf-device-type') || {desktop}
const deviceMatch = imageDeviceOptions[device]

const { asset, regex, ...cache } = cacheAssets.find( ({regex}) => newRequest.pathname.match(regex)) ?? {}

const cf_cache = await fetch(subRequest,
        { cf:
            {
                cacheKey: cache.key,
                cacheEverything: true,
                cacheTtlByStatus: {
                    '100-199': cache.info,
                    '200-299': cache.ok,
                    '300-399': cache.redirects,
                    '400-499': cache.clientError,
                    '500-599': cache.serverError
                    }
            },
        })

let options = deviceMatch || {}; for (k in imageURLOptions) { 
    if (imageURLOptions[k]) options[k] = imageURLOptions[k]; 
}

const imageResizer = cf_cache ? options : {}

const newResponse = await fetch(subRequest,
        { cf:
            {
                image: {
                    width: imageResizer.width,
                    height: imageResizer.height,
                    fit: imageResizer.fit ,
                    metadata: imageResizer.metadata,
                    quality: imageResizer.quality
                    }
            },
        })

let response = new Response(newResponse.body, newResponse)
response.headers.set("IR", JSON.stringify(imageResizer))
response.headers.set("Cache", JSON.stringify(cache))

const catchResponseError = response.ok || response.redirected ? response : await fetch(request)
return catchResponseError
}