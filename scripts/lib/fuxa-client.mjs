import { requestJson, joinUrl, HttpError } from './http.mjs';

export class FuxaClient {
  constructor({ baseUrl, apiKey, username, password, insecure = false, timeoutMs = 10000 }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.username = username;
    this.password = password;
    this.insecure = insecure;
    this.timeoutMs = timeoutMs;
    this.token = null;
  }

  authHeaders() {
    if (this.apiKey) return { 'x-api-key': this.apiKey };
    if (this.token) return { 'x-access-token': this.token };
    return {};
  }

  async request(pathname, options = {}) {
    return requestJson(joinUrl(this.baseUrl, pathname), {
      ...options,
      timeoutMs: options.timeoutMs ?? this.timeoutMs,
      insecure: options.insecure ?? this.insecure,
      headers: { ...this.authHeaders(), ...(options.headers || {}) }
    });
  }

  async signInIfNeeded() {
    if (this.apiKey || this.token || !this.username) return;
    const result = await this.request('/api/signin', {
      method: 'POST',
      body: { username: this.username, password: this.password }
    });
    const token = result.data?.data?.token || result.data?.token || result.data?.accessToken || result.data?.jwt;
    if (!token) throw new Error('FUXA signin succeeded but no token field was recognized.');
    this.token = token;
  }

  async getVersion() { return (await this.request('/api/version')).data; }
  async getSettings() { return (await this.request('/api/settings')).data; }
  async getProject() { await this.signInIfNeeded(); return (await this.request('/api/project')).data; }
  async getDemoProject() { await this.signInIfNeeded(); return (await this.request('/api/projectdemo')).data; }
  async projectData(cmd, data) {
    await this.signInIfNeeded();
    return (await this.request('/api/projectData', { method: 'POST', body: { cmd, data } })).data;
  }
  async getTagValue(id) {
    await this.signInIfNeeded();
    const u = new URL(joinUrl(this.baseUrl, '/api/getTagValue'));
    const ids = Array.isArray(id) ? id : [id];
    u.searchParams.set('ids', JSON.stringify(ids));
    return (await requestJson(u.toString(), {
      timeoutMs: this.timeoutMs,
      insecure: this.insecure,
      headers: this.authHeaders()
    })).data;
  }
  async setTagValue(data) {
    await this.signInIfNeeded();
    return (await this.request('/api/setTagValue', { method: 'POST', body: data })).data;
  }
  async probe(pathname, options = {}) {
    try {
      const result = await this.request(pathname, options);
      return { supported: true, authorized: true, status: result.status, sampleType: typeOf(result.data) };
    } catch (error) {
      if (error instanceof HttpError && [401, 403].includes(error.status)) {
        return { supported: true, authorized: false, status: error.status };
      }
      if (error instanceof HttpError && [400, 405, 422].includes(error.status)) {
        return { supported: true, authorized: true, status: error.status, note: 'Endpoint responded; probe request was intentionally incomplete/non-mutating.' };
      }
      if (error instanceof HttpError && error.status === 404) {
        return { supported: false, authorized: false, status: 404 };
      }
      return { supported: null, authorized: false, error: error.message };
    }
  }
}

function typeOf(v) {
  if (Array.isArray(v)) return 'array';
  if (v === null) return 'null';
  return typeof v;
}
