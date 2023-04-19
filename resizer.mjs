
// async function imageResizingTest(request) {
//     if (!/image-resizing/.test(request.headers.get("via"))) {
//         return newResponse
//     }
// }


export default {
    async fetch(request) {
        // if (!/image-resizing/.test(request.headers.get("via"))) {
            let newRequest = new URL(request.url)
            const newURL = `${newRequest.hostname}${newRequest.pathname}`
            const customCacheKey = `${newRequest.hostname}${newRequest.pathname}${newRequest.searchParams}`
            const urlParams = newRequest.searchParams

            const cacheAssets = [
                { asset: 'image', /*key: customCacheKey,*/ regex: /^.*\.(jpe?g|png|gif|webp|svg)/, info: 0, ok: 31536000, redirects: 31536000, clientError: 10, serverError: 1 },
            ]

            const imageDeviceOptions = {
                desktop: { height: 1440, width: 2560, fit: 'scale-down', metadata: 'copyright', quality: 85/*, format: 'auto'*/ },
                tablet: { height: 1080, width: 1920, fit: 'scale-down', metadata: 'copyright', quality: 85/*, format: 'auto'*/ },
                mobile: { height: 720, width: 1280, fit: 'scale-down', metadata: 'copyright', quality: 85/*, format: 'auto'*/ }
            }

            const height = urlParams.get('height') || undefined
            const width = urlParams.get('width') || undefined
            const fit = urlParams.get('fit') || undefined
            const quality = urlParams.get('quality') || undefined
            const metadata = urlParams.get('metadata') || undefined
            const format = urlParams.get('format') || undefined

            const imageURLOptions = { width, height, fit, quality, metadata, format }

            let subRequest = new Request(request.headers)
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

            if (/image\/avif/.test(accept)) {
                imageResizer.format = 'avif'
            } else if (/image\/webp/.test(accept)) {
                imageResizer.format = 'webp'
            }

            let newResponse = await fetch(request,
                {
                    cf:
                    {
                        polish: "off",
                        mirage: false,
                        cacheKey: cache.key,
                        cacheEverything: true,
                        cacheTtlByStatus: {
                            '100-199': cache.info,
                            '200-299': cache.ok,
                            '300-399': cache.redirects,
                            '400-499': cache.clientError,
                            '500-599': cache.serverError
                        },
                        image: imageResizer,
                        cacheTags: [
                            "image"
                        ]
                    },
                })

            let response = new Response(newResponse.body, newResponse)
            response.headers.set("debug-ir", JSON.stringify(imageResizer))
            response.headers.set("debug-cache", JSON.stringify(cache))

            const catchResponseError = response.ok || response.redirected ? response : await fetch(request)
            if (!/image-resizing/.test(request.headers.get("via"))) {
                return catchResponseError
            }
        }
    }
// }