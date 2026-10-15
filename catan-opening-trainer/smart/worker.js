// Rules, search and model inference stay off the Flutter/Pyodide event loop.
import init, { TrainerEngine } from "./catan_engine.js";
import { runGame } from "./runner.js";

let ready;
function boot() {
  return ready ??= (async () => {
    await init();
    const metadataResponse = await fetch(new URL("./v89w.json", import.meta.url));
    const modelResponse = await fetch(new URL("./v89w.bin", import.meta.url));
    if (!metadataResponse.ok || !modelResponse.ok) throw new Error("Could not load the v89w model");
    const metadata = await metadataResponse.json();
    const weights = new Uint8Array(await modelResponse.arrayBuffer());
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", weights));
    const hash = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
    if (weights.length !== metadata.bytes || hash !== metadata.sha256) throw new Error("v89w model checksum mismatch");
    return new TrainerEngine(weights);
  })();
}

// Requests serialize, including the first request while the engine/model are loading.
let queue = Promise.resolve();
let cancelled = false;
self.onmessage = event => {
  const request = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  if (request.op === "cancel") { cancelled = true; return; }
  // Reset before queueing so a cancellation during async boot is remembered.
  if (request.op === "run") cancelled = false;
  queue = queue.then(async () => {
    try {
      const engine = await boot();
      const result = request.op === "run"
        ? (cancelled ? {cancelled: true} : await runGame(engine, request, () => cancelled,
            progress => self.postMessage({id: request.id, event: "progress", ...progress})))
        : JSON.parse(engine.request(JSON.stringify(request)));
      self.postMessage(JSON.stringify({ id: request.id, ok: true, result }));
    } catch (error) {
      self.postMessage(JSON.stringify({ id: request.id, ok: false, error: String(error) }));
    }
  });
};
