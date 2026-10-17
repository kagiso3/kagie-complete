const { URL } = require("node:url");
const path = require("node:path");

function normalizeHeaders(headers = {}) {
  return Object.entries(headers).reduce((acc, [key, value]) => {
    acc[key] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    return acc;
  }, {});
}

function queryParamsFromUrl(urlString) {
  const url = new URL(urlString || "/", "https://kagie.local");
  const params = {};
  url.searchParams.forEach((value, key) => {
    if (!(key in params)) params[key] = value;
  });
  return { pathname: url.pathname, queryStringParameters: params };
}

async function readRawBody(req, { requireRawBody = false, maxBodyBytes = 1024 * 1024 } = {}) {
  if (!req || ["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase())) return "";

  const tooLarge = () => Object.assign(new Error("Request body is too large."), { statusCode: 413 });
  const bounded = value => {
    if (Buffer.byteLength(value) > maxBodyBytes) throw tooLarge();
    return value;
  };

  if (req.readable) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buffer.length;
      if (size > maxBodyBytes) throw tooLarge();
      chunks.push(buffer);
    }
    if (chunks.length) return Buffer.concat(chunks).toString("utf8");
  }

  if (Buffer.isBuffer(req.body)) return bounded(req.body.toString("utf8"));
  if (typeof req.body === "string") return bounded(req.body);
  if (req.body && typeof req.body === "object") {
    if (requireRawBody) throw Object.assign(new Error("This endpoint requires the original request body."), { statusCode: 400 });
    return bounded(JSON.stringify(req.body));
  }
  return "";
}

function applyServerlessResponse(res, payload) {
  const statusCode = Number(payload?.statusCode || 200);
  const headers = payload?.headers || {};
  const body = payload?.body ?? "";

  Object.entries(headers).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      res.setHeader(key, value);
    }
  });

  res.statusCode = statusCode;
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function loadServerlessHandler(handlerPath) {
  const mod = require(handlerPath);
  const handler = mod?.handler || mod?.default || mod;
  if (typeof handler !== "function") {
    throw new Error(`Serverless handler not found at ${handlerPath}`);
  }
  return handler;
}

function createServerlessAdapter(relativeHandlerPath, options = {}) {
  const handlerPath = path.resolve(relativeHandlerPath);

  return async function vercelHandler(req, res) {
    try {
      const rawBody = await readRawBody(req, options);
      const { pathname, queryStringParameters } = queryParamsFromUrl(req.url || "/");
      const event = {
        httpMethod: String(req.method || "GET").toUpperCase(),
        headers: normalizeHeaders(req.headers),
        queryStringParameters,
        path: pathname,
        rawUrl: req.url || pathname,
        body: rawBody,
        isBase64Encoded: false
      };
      const result = await loadServerlessHandler(handlerPath)(event, {});
      applyServerlessResponse(res, result);
    } catch (error) {
      res.statusCode = Number(error?.statusCode || 500);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        message: res.statusCode < 500 ? error?.message || "Invalid request." : "Unexpected server error."
      }));
    }
  };
}

module.exports = {
  createServerlessAdapter
};
