const API = "/api/executions";

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const executeTree = (rootNodeId) =>
  request(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ root_node_id: rootNodeId }),
  });

export const fetchExecutions = () => request(API);

export const fetchRun = (runId) => request(`${API}/${runId}`);
