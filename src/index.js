// Main Worker entry point
import { handleImageRequest } from "./handlers/imageHandler";

export default {
  fetch: (request, env, ctx) => {
    // Skip resizing for Cloudflare's own requests
    if (
      !/image-resizing/.test(request.headers.get("via")) &&
      !/undici/.test(request.headers.get("user-agent")) &&
      !/node/.test(request.headers.get("user-agent"))
    ) {
      return handleImageRequest(request);
    }
    return fetch(request); // pass-through and continue
  },
};
