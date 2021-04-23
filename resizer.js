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
    {asset: 'image', key: customCacheKey, regex: /^.*\.(jpg|jpeg|png|bmp|pict|tif|tiff|webp|gif|heif|exif|bat|bpg|ppm|pgn|pbm|pnm)/, info: 0, ok: 86400, redirects: 30, clientError: 10, serverError: 0 },
]

const imageDeviceOptions = {
    desktop: {height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 85},
    tablet: {height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 85},
    mobile: {height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 85}
}

const height = urlParams.has('height') // ? urlParams.get('height') : ''
const width = urlParams.has('width') //? urlParams.get('width') : ''
const fit = urlParams.has('fit') //? urlParams.get('fit') : ''
const quality = urlParams.has('quality') //? urlParams.get('quality') : ''
const metadata = urlParams.has('metadata') //? urlParams.get('metadata') : ''

const imageURLOptions = { width, height, fit, quality, metadata }

const subRequest = new Request(request)
const device = subRequest.headers.get('cf-device-type')
const deviceMatch = imageDeviceOptions[device || {}]

const cacheAssets_match = cacheAssets.find( ({regex}) => customCacheKey.toLowerCase().match(regex))
const cache = cacheAssets_match ? cacheAssets_match : {}
/*
const imageDeviceResized = imageDeviceOptions.find( ({asset}) => device == asset)
const imageURLResized = imageURLOptions.find( ({asset}) => urlParams.get(asset))
*/
const imageResizer = cache ? deviceMatch || imageURLOptions : {}

const newResponse = await fetch(subRequest,
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
                    },
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
response.headers.set("debug", JSON.stringify(imageResizer))

const catchResponseError = response.ok ? response : await fetch(newRequest)
return catchResponseError
}