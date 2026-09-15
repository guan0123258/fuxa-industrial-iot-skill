import http from 'node:http';
import https from 'node:https';

export class HttpError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

function redactUrl(raw) {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (/token|key|secret|password|auth/i.test(key)) u.searchParams.set(key, '***');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function requestJson(rawUrl, {
  method = 'GET',
  headers = {},
  body,
  timeoutMs = 10000,
  insecure = false,
  allowStatuses = []
} = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(rawUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body === undefined ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const requestHeaders = { Accept: 'application/json', ...headers };
    if (payload) {
      if (!Object.keys(requestHeaders).some((k) => k.toLowerCase() === 'content-type')) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      requestHeaders['Content-Length'] = payload.length;
    }

    const req = transport.request(url, {
      method,
      headers: requestHeaders,
      rejectUnauthorized: !insecure
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const contentType = String(res.headers['content-type'] || '');
        let data = text;
        if (text && (contentType.includes('json') || /^[\[{\"]/.test(text.trim()))) {
          try { data = JSON.parse(text); } catch { /* keep text */ }
        }
        const ok = (res.statusCode >= 200 && res.statusCode < 300) || allowStatuses.includes(res.statusCode);
        if (!ok) {
          reject(new HttpError(`HTTP ${res.statusCode} ${method} ${redactUrl(rawUrl)}`, {
            status: res.statusCode,
            body: data,
            url: redactUrl(rawUrl)
          }));
          return;
        }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });

    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Request timeout after ${timeoutMs}ms: ${redactUrl(rawUrl)}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export function joinUrl(base, pathname) {
  const normalized = base.endsWith('/') ? base : `${base}/`;
  return new URL(String(pathname).replace(/^\//, ''), normalized).toString();
}
