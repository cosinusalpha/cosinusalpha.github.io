import { EnginePool } from "./pool.js";

const pool = new EnginePool();
self.onmessage = async ({data}) => {
  const request = typeof data === "string" ? JSON.parse(data) : data;
  if (request.op === "cancel") { pool.cancel(); return; }
  if (request.op === "close") { pool.close(); self.close(); return; }
  try {
    const result = await pool.request(request, event => {
      self.postMessage(JSON.stringify({id: request.id, ...event}));
    });
    self.postMessage(JSON.stringify({id: request.id, ok: true, result}));
  } catch (error) {
    self.postMessage(JSON.stringify({id: request.id, ok: false, error: String(error)}));
  }
};
