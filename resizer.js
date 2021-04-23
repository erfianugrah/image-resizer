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

const imageDevice = [
    {asset: 'desktop', height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 85},
    {asset: 'tablet', height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 85},
    {asset: 'mobile', height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 85}
]

const height = urlParams.has('height') ? urlParams.get('height') : {}
const width = urlParams.has('width') ? urlParams.get('width') : {}
const fit = urlParams.has('fit') ? urlParams.get('fit') : {}
const quality = urlParams.has('quality') ? urlParams.get('quality') : {}
const metadata = urlParams.has('metadata') ? urlParams.get('metadata') : {}

const imageURL = [
    {asset: 'height', height}, 
    {asset: 'width', width}, 
    {asset: 'fit', fit}, 
    {asset: 'quality', quality}, 
    {asset: 'metadata', metadata}
]

const subRequest = new Request(request)
const device = subRequest.headers.get('cf-device-type')

const cacheAssets_match = cacheAssets.find( ({regex}) => customCacheKey.toLowerCase().match(regex))
const cache = cacheAssets_match ? cacheAssets_match : {}

const imageDeviceResized = imageDevice.find( ({asset}) => device == asset)
const imageURLResized = imageURL.find( ({asset}) => urlParams.get(asset))
const image = cache ? imageDeviceResized || imageURLResized : {}

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
                    width: image.width,
                    height: image.height,
                    fit: image.fit ,
                    metadata: image.metadata,
                    quality: image.quality
                    }
            },
        })

let response = new Response(newResponse.body, newResponse)
response.headers.set("debug", JSON.stringify(image))
response.headers.set("imageDeviceResized", console.log(imageDeviceResized))
response.headers.set("imageDeviceResized", console.log(imageURLResized))

const catchResponseError = response.ok ? response : await fetch(newRequest)
return catchResponseError
}