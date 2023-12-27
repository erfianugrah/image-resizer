export default {
    fetch: (request, env, ctx) => {
        if (!/image-resizing/.test(request.headers.get("via")) && !/undici/.test(request.headers.get("user-agent")) && !/node/.test(request.headers.get("user-agent"))) {
            return resizer(request);
        }
        return fetch(request); // pass-through and continue
    }
}

async function resizer(request) {
    let newRequest = new URL(request.url)
    const newURL = `${newRequest.hostname}${newRequest.pathname}`
    // const customCacheKey = `${newRequest.hostname}${newRequest.pathname}${newRequest.searchParams}`
    const urlParams = newRequest.searchParams

    const cacheAssets = [
        { asset: 'image', /*key: customCacheKey,*/mirage: off, minified: { javascript: false, css: true, html: false }, imageCompression: off, cachability: true, regex: /^.*\.(jpe?g|JPG|png|gif|webp|svg)$/, info: 0, ok: 31536000, redirects: 31536000, clientError: 10, serverError: 1 },
    ]

    const imageDeviceOptions = {
        desktop: { height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 80/*, format: 'auto'*/ },
        tablet: { height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 80/*, format: 'auto'*/ },
        mobile: { height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 80/*, format: 'auto'*/ }
    }

    const height = urlParams.get('height') || undefined
    const width = urlParams.get('width') || undefined
    const fit = urlParams.get('fit') || undefined
    const quality = urlParams.get('quality') || undefined
    const metadata = urlParams.get('metadata') || undefined
    const format = urlParams.get('format') || undefined

    const imageURLOptions = { width, height, fit, quality, metadata, format }

    let subRequest = new Request(newURL, request)
    subRequest.headers.set("cf-feat-tiered-cache", "image")
    const device = subRequest.headers.get("cf-device-type")
    const deviceMatch = imageDeviceOptions[device] || imageDeviceOptions.desktop

    const { asset, regex, ...cache } = cacheAssets.find(({ regex }) => newURL.match(regex)) ?? {}

    let options = deviceMatch || {}

    for (const urlParam in imageURLOptions) {
        if (imageURLOptions[urlParam])
            options[urlParam] = imageURLOptions[urlParam]
    }

    const imageResizer = cache ? options : {}

    const accept = request.headers.get("Accept")

    imageResizer.format = 'avif'; // Set to 'avif' by default

    if (!/image\/avif/.test(accept) && /image\/webp/.test(accept)) {
        imageResizer.format = 'webp'; // Fallback to 'webp' if 'avif' is not present
    }

    let newResponse = await fetch(request,
        {
            headers: {
                "cf-feat-tiered-cache": "image"
            },
            cf:
            {
                polish: cache.imageCompression,
                mirage: cache.mirage,
                // cacheKey: cache.key,
                cacheEverything: cache.cachability,
                cacheTtl: cache.ok,
                // cacheTtlByStatus: {
                //     '100-199': cache.info,
                //     '200-299': cache.ok,
                //     '300-399': cache.redirects,
                //     '400-499': cache.clientError,
                //     '500-599': cache.serverError
                // },
                image: {
                    width: imageResizer.width,
                    height: imageResizer.height,
                    fit: imageResizer.fit,
                    metadata: imageResizer.metadata,
                    quality: imageResizer.quality,
                    format: imageResizer.format
                },
                cacheTags: [
                    "image"
                ]
            },
        })

    let response = new Response(newResponse.body, newResponse)

    let cacheControl = '';

    // Find the matching asset in the cacheAssets array
    let matchedAsset = cacheAssets.find(asset => asset.regex.test(newURL));

    if (matchedAsset) {
        // Set the cache-control header based on the asset type
        if (response.status >= 200 && response.status < 300) {
            cacheControl = `public, max-age=${matchedAsset.ok}`;
        } else if (response.status >= 300 && response.status < 400) {
            cacheControl = `public, max-age=${matchedAsset.redirects}`;
        } else if (response.status >= 400 && response.status < 500) {
            cacheControl = `public, max-age=${matchedAsset.clientError}`;
        } else if (response.status >= 500 && response.status < 600) {
            cacheControl = `public, max-age=${matchedAsset.serverError}`;
        }
    }

    // Set the cache-control header on the response
    response.headers.set('Cache-Control', cacheControl);
    response.headers.set("debug-ir", JSON.stringify(imageResizer))
    response.headers.set("debug-cache", JSON.stringify(cache))

    const catchResponseError = response.ok || response.redirected ? response : await fetch(request)
    return catchResponseError
}