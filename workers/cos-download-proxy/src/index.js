const textEncoder = new TextEncoder();
const DEFAULT_PREFIX = "HARTLinkStudio/ota";
const VERSIONED_CACHE_CONTROL = "public, max-age=31536000, immutable";
const LATEST_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";
const PASSTHROUGH_HEADERS = [
  "accept-ranges",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha1Hex(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-1", textEncoder.encode(value)));
}

async function hmacSha1Hex(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(value)));
}

export async function createCosAuthorization({
  method,
  pathname,
  host,
  secretId,
  secretKey,
  nowSeconds = Math.floor(Date.now() / 1000),
  validitySeconds = 600,
}) {
  const start = nowSeconds - 60;
  const keyTime = `${start};${nowSeconds + validitySeconds}`;
  const headerList = "host";
  const httpHeaders = `host=${host.toLowerCase()}`;
  const httpString = `${method.toLowerCase()}\n${pathname}\n\n${httpHeaders}\n`;
  const signKey = await hmacSha1Hex(secretKey, keyTime);
  const stringToSign = `sha1\n${keyTime}\n${await sha1Hex(httpString)}\n`;
  const signature = await hmacSha1Hex(signKey, stringToSign);

  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");
}

function normalizedPrefix(value) {
  const prefix = (value || DEFAULT_PREFIX).replace(/^\/+|\/+$/g, "");
  if (!prefix || !/^[A-Za-z0-9._/-]+$/.test(prefix) || prefix.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("COS_PREFIX is invalid");
  }
  return prefix;
}

export function isAllowedDownloadPath(pathname, prefix = DEFAULT_PREFIX) {
  let configuredPrefix;
  try {
    configuredPrefix = normalizedPrefix(prefix);
  } catch {
    return false;
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(pathname) || pathname.includes("//") || !pathname.startsWith(`/${configuredPrefix}/`)) {
    return false;
  }

  const parts = pathname.slice(1).split("/");
  return !parts.some((part) => !part || part === "." || part === "..");
}

function safeResponseHeaders(originResponse, pathname) {
  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = originResponse.headers.get(name);
    if (value) headers.set(name, value);
  }

  const isLatest = pathname.endsWith("/latest.json");
  headers.set("Cache-Control", isLatest ? LATEST_CACHE_CONTROL : VERSIONED_CACHE_CONTROL);
  headers.set("Access-Control-Allow-Origin", "https://modusignal.cn");
  headers.set("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Content-Range, ETag");
  headers.set("Cross-Origin-Resource-Policy", "same-site");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");

  if (!isLatest && !headers.has("Content-Disposition")) {
    const fileName = pathname.split("/").at(-1);
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
  }
  return headers;
}

function plainResponse(message, status, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

async function proxyRequest(request, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return plainResponse("Method not allowed", 405, { Allow: "GET, HEAD" });
  }

  const requestUrl = new URL(request.url);
  const prefix = normalizedPrefix(env.COS_PREFIX);
  const publicHost = (env.PUBLIC_HOST || "download.modusignal.cn").toLowerCase();
  if (requestUrl.hostname.toLowerCase() !== publicHost || requestUrl.search || !isAllowedDownloadPath(requestUrl.pathname, prefix)) {
    return plainResponse("Not found", 404);
  }

  if (!env.COS_BUCKET || !env.COS_REGION || !env.COS_SECRET_ID || !env.COS_SECRET_KEY) {
    return plainResponse("Download service is not configured", 503);
  }

  const isRangeRequest = request.headers.has("Range");
  const cache = caches.default;
  const cacheKey = new Request(requestUrl.toString(), { method: "GET" });
  if (request.method === "GET") {
    const cached = await cache.match(new Request(cacheKey, { headers: isRangeRequest ? { Range: request.headers.get("Range") } : {} }));
    if (cached) return cached;
  }

  const host = `${env.COS_BUCKET}.cos.${env.COS_REGION}.myqcloud.com`;
  const authorization = await createCosAuthorization({
    method: request.method,
    pathname: requestUrl.pathname,
    host,
    secretId: env.COS_SECRET_ID,
    secretKey: env.COS_SECRET_KEY,
  });
  const originHeaders = new Headers({ Authorization: authorization });
  for (const name of ["Range", "If-Range", "If-None-Match", "If-Modified-Since"]) {
    const value = request.headers.get(name);
    if (value) originHeaders.set(name, value);
  }

  const originResponse = await fetch(`https://${host}${requestUrl.pathname}`, {
    method: request.method,
    headers: originHeaders,
    redirect: "manual",
  });

  if (originResponse.status >= 400) {
    return plainResponse(originResponse.status === 404 ? "Not found" : "Download unavailable", originResponse.status);
  }

  const response = new Response(request.method === "HEAD" ? null : originResponse.body, {
    status: originResponse.status,
    statusText: originResponse.statusText,
    headers: safeResponseHeaders(originResponse, requestUrl.pathname),
  });

  if (request.method === "GET" && !isRangeRequest && originResponse.status === 200) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch((error) => console.warn("Unable to cache COS object", error)));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await proxyRequest(request, env, ctx);
    } catch (error) {
      console.error("COS download proxy failed", error);
      return plainResponse("Download service error", 502);
    }
  },
};
