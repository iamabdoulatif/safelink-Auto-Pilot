function loadEnv() {
  // quiet: true — sinon dotenv (v17+) affiche "◇ injected env" a chaque appel.
  try {
    require("dotenv").config({ quiet: true });
  } catch {
    // dotenv is optional; falls back to process.env as-is
  }
  try {
    require("dotenv").config({ path: ".env.local", override: true, quiet: true });
  } catch {
    // no .env.local — fine
  }
}

function basicAuthHeader(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass ?? ""}`).toString("base64")}`;
}

function joinUrl(base, path) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

// RouterOS REST verbs (see routeros-fundamentals: PUT=add, PATCH=set,
// DELETE=remove, POST=command, GET=print).
function createRouterClient({ baseUrl, user, pass, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!baseUrl) throw new Error("ROUTEROS_URL is not set");
  if (!user) throw new Error("ROUTEROS_USER is not set");
  const auth = basicAuthHeader(user, pass);

  async function request(path, { method = "GET", body } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(joinUrl(baseUrl, path), {
        method,
        signal: ctrl.signal,
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
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
      if (!res.ok) {
        const msg = data?.message ?? data?.detail ?? res.statusText;
        throw new Error(`RouterOS ${method} ${path} -> ${res.status}: ${msg}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    // No auth — WebFig root returns 200 when the box is alive.
    async ping() {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(joinUrl(baseUrl, "/"), { signal: ctrl.signal });
        return res.ok;
      } finally {
        clearTimeout(timer);
      }
    },
    // Authenticated read-back: CPU, memory, version.
    resource() {
      return request("/rest/system/resource");
    },
    list(path, query = "") {
      return request(`/rest/${path.replace(/^\/+/, "")}${query}`);
    },
    // PUT creates a new record (NOT an update).
    create(path, record) {
      return request(`/rest/${path.replace(/^\/+/, "")}`, { method: "PUT", body: record });
    },
    // PATCH updates an existing record by *HEX id.
    update(path, id, fields) {
      return request(`/rest/${path.replace(/^\/+/, "")}/${id}`, { method: "PATCH", body: fields });
    },
    remove(path, id) {
      return request(`/rest/${path.replace(/^\/+/, "")}/${id}`, { method: "DELETE" });
    },
    // POST executes a command (reboot, flush, run, ...).
    command(path, params = {}) {
      return request(`/rest/${path.replace(/^\/+/, "")}`, { method: "POST", body: params });
    },
  };
}

module.exports = { loadEnv, createRouterClient, basicAuthHeader };
