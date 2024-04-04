export default {
  fetch: (request, env, ctx) => {
    if (
      !/image-resizing/.test(request.headers.get("via")) &&
      !/undici/.test(request.headers.get("user-agent")) &&
      !/node/.test(request.headers.get("user-agent"))
    ) {
      return resizer(request);
    }
    return fetch(request); // pass-through and continue
  },
};

async function resizer(request) {
  const newRequest = new URL(request.url);
  const newURL = `${newRequest.hostname}${newRequest.pathname}`;
  // const customCacheKey = `${newRequest.hostname}${newRequest.pathname}${newRequest.searchParams}`
  const urlParams = newRequest.searchParams;

  const cacheAssets = [
    {
      asset: "image",
      /*key: customCacheKey,*/
      mirage: false,
      minified: { javascript: false, css: true, html: false },
      imageCompression: "off",
      cacheability: true,
      regex: /^.*\.(jpe?g|JPG|png|gif|webp|svg)$/,
      info: 0,
      ok: 31536000,
      redirects: 31536000,
      clientError: 10,
      serverError: 1,
    },
  ];

  const imageDeviceOptions = {
    desktop: {
      height: 1440,
      width: 2560,
      fit: "scale-down",
      metadata: "copyright",
      quality: 80, /*, format: 'auto'*/
    },
    tablet: {
      height: 1080,
      width: 1920,
      fit: "scale-down",
      metadata: "copyright",
      quality: 80, /*, format: 'auto'*/
    },
    mobile: {
      height: 720,
      width: 1280,
      fit: "scale-down",
      metadata: "copyright",
      quality: 80, /*, format: 'auto'*/
    },
  };

  const height = urlParams.get("height") || undefined;
  const width = urlParams.get("width") || undefined;
  const fit = urlParams.get("fit") || undefined;
  const quality = urlParams.get("quality") || undefined;
  const metadata = urlParams.get("metadata") || undefined;
  const format = urlParams.get("format") || undefined;

  const imageURLOptions = { width, height, fit, quality, metadata, format };

  const subRequest = new Request(newURL, request);
  const device = subRequest.headers.get("cf-device-type");
  const deviceMatch = imageDeviceOptions[device] || imageDeviceOptions.desktop;

  const { ...cache } = cacheAssets.find(({ regex }) => newURL.match(regex)) ??
    {};

  const options = deviceMatch || {};

  for (const urlParam in imageURLOptions) {
    if (imageURLOptions[urlParam]) {
      options[urlParam] = imageURLOptions[urlParam];
    }
  }

  const imageResizer = cache ? options : {};

  const accept = request.headers.get("Accept");

  imageResizer.format = "avif"; // Set to 'avif' by default

  if (!/image\/avif/.test(accept) && /image\/webp/.test(accept)) {
    imageResizer.format = "webp"; // Fallback to 'webp' if 'avif' is not present
  }

  const newResponse = await fetch(request, {
    headers: {
      "cf-feat-tiered-cache": "image",
    },
    cf: {
      polish: cache.imageCompression || "off",
      mirage: cache.mirage || false,
      // cacheKey: cache.key,
      cacheEverything: cache.cacheability || false,
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
        format: imageResizer.format,
      },
      cacheTags: [
        "image",
      ],
    },
  });

  const response = new Response(newResponse.body, newResponse);

  let cacheControl = "";

  // Find the matching asset in the cacheAssets array
  const matchedAsset = cacheAssets.find((asset) =>
    asset.regex.test(newRequest)
  );

  if (matchedAsset) {
    const prop = [
      "ok",
      "redirects",
      "clientError",
      "serverError",
    ][Math.floor(response.status / 100) - 2] || 0;
    cacheControl = prop && `public, max-age=${matchedAsset[prop]}`;
  }

  // Set the cache-control header on the response
  response.headers.set("Cache-Control", cacheControl);
  response.headers.set("debug-ir", JSON.stringify(imageResizer));
  response.headers.set("debug-cache", JSON.stringify(cache));

  const catchResponseError = response.ok || response.redirected
    ? response
    : await fetch(request);
  return catchResponseError;
}
