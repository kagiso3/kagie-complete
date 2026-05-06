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

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  if (!req.readable || ["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase())) return "";

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
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

function createServerlessAdapter(relativeHandlerPath) {
  const handlerPath = path.resolve(relativeHandlerPath);

  return async function vercelHandler(req, res) {
    try {
      const rawBody = await readRawBody(req);
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
        message: error?.message || "Unexpected serverless adapter failure."
      }));
    }
  };
}

module.exports = {
  createServerlessAdapter
};
