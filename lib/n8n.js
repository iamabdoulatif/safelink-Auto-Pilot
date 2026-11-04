function n8nConfig(env = process.env) {
  return {
    baseUrl: (env.N8N_BASE_URL ?? "").replace(/\/+$/, ""),
    webhookSecret: env.N8N_WEBHOOK_SECRET ?? "",
    callbackSecret: env.N8N_CALLBACK_SECRET ?? "",
    appUrl: (env.APP_URL ?? "").replace(/\/+$/, ""),
  };
}

function createN8nClient({ baseUrl, secret, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!baseUrl) throw new Error("N8N_BASE_URL is not set");

  async function request(path, { method = "GET", body, extraHeaders = {} } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-Webhook-Secret": secret } : {}),
          ...extraHeaders,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!res.ok) throw new Error(`n8n ${method} ${path} -> ${res.status}: ${res.statusText}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async ping() {
      // n8n answers GET / with 200 when up (auth page or JSON).
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(`${baseUrl}/`, { signal: ctrl.signal });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    },
    // Fire a workflow webhook; payload always carries a callback URL
    // so n8n can report back to APP_URL.
    triggerWebhook(webhookPath, payload = {}, appUrl = "") {
      const body = appUrl
        ? { ...payload, callbackUrl: `${appUrl}/api/n8n/callback` }
        : payload;
      return request(webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`, {
        method: "POST",
        body,
      });
    },
  };
}

module.exports = { n8nConfig, createN8nClient };
