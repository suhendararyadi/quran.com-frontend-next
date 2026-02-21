import { EventEmitter } from 'events';

import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { NextApiRequest, NextApiResponse } from 'next';

const ERROR_MESSAGES = {
  PROXY_ERROR: 'Proxy error',
  PROXY_HANDLER_ERROR: 'Proxy handler error',
  FORBIDDEN: 'Forbidden',
};

const ALLOWED_DOMAINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((domain) => domain.trim());

EventEmitter.defaultMaxListeners = Number(process.env.PROXY_DEFAULT_MAX_LISTENERS) || 100;

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // Allow server-side requests (no origin)
  try {
    const url = new URL(origin);
    const { hostname } = url;
    return ALLOWED_DOMAINS.includes(hostname);
  } catch {
    return false;
  }
};

// Map service names to their public API hosts
const SERVICE_HOSTS: Record<string, string> = {
  content:
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
      ? 'https://api.qurancdn.com'
      : 'https://staging.quran.com',
  auth:
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
      ? 'https://api.qurancdn.com'
      : 'https://staging.quran.com',
  search:
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
      ? 'https://api.qurancdn.com'
      : 'https://staging.quran.com',
};

const DEFAULT_HOST =
  process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
    ? 'https://api.qurancdn.com'
    : 'https://staging.quran.com';

const apiProxy = createProxyMiddleware<NextApiRequest, NextApiResponse>({
  target: DEFAULT_HOST,
  changeOrigin: true,
  // Strip /api/proxy/{service} prefix, keeping the rest of the path
  pathRewrite: (path) => {
    // /api/proxy/content/api/qdc/chapters -> /api/qdc/chapters
    // /api/proxy/auth/courses -> /courses
    // /api/proxy/search/v1/search -> /v1/search
    return path.replace(/^\/api\/proxy\/[^/]+/, '');
  },
  router: (req) => {
    // Route to different hosts based on service name
    const match = req.url?.match(/^\/api\/proxy\/([^/]+)/);
    const service = match ? match[1] : 'content';
    return SERVICE_HOSTS[service] || DEFAULT_HOST;
  },
  secure: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
  logger: console,

  on: {
    proxyReq: (proxyReq, req, res) => {
      const origin = req.headers.origin || req.headers.referer || '';
      if (origin && !isOriginAllowed(origin)) {
        (res as NextApiResponse).status(403).send({ error: ERROR_MESSAGES.FORBIDDEN });
        return;
      }

      // Attach cookies if present
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }

      fixRequestBody(proxyReq, req);
    },

    proxyRes: (proxyRes, req, res) => {
      const proxyCookies = proxyRes.headers['set-cookie'];
      if (proxyCookies) {
        res.setHeader('Set-Cookie', proxyCookies);
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },

    error: (err, req, res) => {
      if ('status' in res && typeof res.status === 'function') {
        res.status(500).json({ error: ERROR_MESSAGES.PROXY_ERROR, message: err.message });
      } else {
        res.end(JSON.stringify({ error: ERROR_MESSAGES.PROXY_ERROR, message: err.message }));
      }
    },
  },
});

const API_BODY_SIZE_LIMIT = process.env.API_BODY_SIZE_LIMIT || '8mb';

export const config = {
  api: {
    externalResolver: true,
    bodyParser: {
      sizeLimit: API_BODY_SIZE_LIMIT,
    },
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  apiProxy(req, res, (err) => {
    if (err) {
      res.status(500).json({ error: ERROR_MESSAGES.PROXY_HANDLER_ERROR, message: err.message });
    }
  });
}
