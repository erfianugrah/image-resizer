addEventListener('fetch', event => {
    return event.respondWith(handleRequest(event.request));
})

async function handleRequest(request) {

const newRequest = new URL(request.url)
const customCacheKey = newRequest.hostname + newRequest.pathname
const queryCacheKey = newRequest.hostname + newRequest.pathname + newRequest.searchParams

const cacheAssets = [
    {asset: 'image', key: queryCacheKey, regex: /^.*\.(jpeg|jpg|png|dng|tiff|webp|gif)/, info: 0, ok: 3600, redirects: 30, clientError: 10, serverError: 0 },
]

}