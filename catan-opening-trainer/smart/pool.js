// This lightweight coordinator owns at most two compute workers. Their models
// survive successive batches; one is also reused for the AI's opening moves.
export class EnginePool {
  constructor({createWorker = () => new Worker(new URL("./worker.js", import.meta.url), {type: "module"}),
               cores = globalThis.navigator?.hardwareConcurrency ?? 1} = {}) {
    this.createWorker = createWorker;
    this.limit = cores >= 4 ? 2 : 1;
    this.workers = [];
    this.nextId = 0;
    this.active = null;
    this.closed = false;
  }

  worker() {
    const worker = this.createWorker();
    const slot = {worker, pending: new Map()};
    worker.onmessage = ({data}) => {
      const message = typeof data === "string" ? JSON.parse(data) : data;
      const pending = slot.pending.get(message.id);
      if (!pending) return;
      if (message.event) { pending.progress?.(message); return; }
      slot.pending.delete(message.id);
      message.ok ? pending.resolve(message.result) : pending.reject(new Error(message.error));
    };
    worker.onerror = event => this.fail(new Error(event.message || "Simulation worker failed"));
    worker.onmessageerror = () => this.fail(new Error("Invalid simulation worker message"));
    this.workers.push(slot);
    return slot;
  }

  call(slot, request, progress) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      slot.pending.set(id, {resolve, reject, progress});
      try { slot.worker.postMessage({...request, id}); }
      catch (error) { slot.pending.delete(id); reject(error); }
    });
  }

  async request(request, emit = () => {}) {
    if (this.closed) throw new Error("Engine pool is closed");
    if (this.active) throw new Error("Simulation batch is already running");
    if (request.op !== "batch") {
      return this.call(this.workers[0] ?? this.worker(), request);
    }
    const state = {cancelled: false, next: 0, done: 0, lastProgress: -Infinity};
    this.active = state;
    try {
      const size = Math.min(request.jobs.length, this.limit);
      while (this.workers.length < size) this.worker();
      const run = async slot => {
        await this.call(slot, request.opening);
        while (!state.cancelled && state.next < request.jobs.length) {
          const job = request.jobs[state.next++];
          const result = await this.call(slot, {op: "run", ...job,
            max_turns: request.max_turns, max_actions: request.max_actions}, progress => {
            const now = performance.now();
            if (!state.cancelled && now - state.lastProgress >= 200) {
              state.lastProgress = now;
              emit({event: "progress", done: state.done, index: job.index, turns: progress.turns});
            }
          });
          if (result.result) {
            state.done++;
            emit({event: "completed", ...job, ...result, done: state.done});
          }
        }
      };
      // Wait for every lane even on error, so nothing from the failed batch can
      // arrive after the next one has begun. Keep completed games on failure.
      const lanes = this.workers.slice(0, size).map(slot => run(slot).catch(error => {
        this.cancel();
        throw error;
      }));
      const settled = await Promise.allSettled(lanes);
      const failure = settled.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
      return {cancelled: state.cancelled, completed: state.done, workers: size};
    } finally {
      this.active = null;
    }
  }

  cancel() {
    if (this.active) this.active.cancelled = true;
    for (const slot of this.workers) slot.worker.postMessage({op: "cancel"});
  }

  fail(error) {
    this.cancel();
    for (const slot of this.workers) {
      slot.worker.terminate();
      for (const pending of slot.pending.values()) pending.reject(error);
      slot.pending.clear();
    }
    this.workers = [];
  }

  close() {
    this.closed = true;
    this.fail(new Error("Engine pool is closed"));
  }
}
