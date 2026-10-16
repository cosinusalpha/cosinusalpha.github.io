// A complete game stays inside its compute worker. Yield only to let cancellation
// through; no Python/UI round trip is needed to advance the next eight actions.
export async function runGame(engine, request, cancelled, progress) {
  const started = performance.now();
  let computeMs = 0;
  let calls = 0;
  const call = data => {
    const start = performance.now();
    const value = JSON.parse(engine.request(JSON.stringify(data)));
    computeMs += performance.now() - start;
    calls++;
    return value;
  };
  let result = call({op: "begin", seed: request.seed,
    dice_mode: request.dice_mode,
    max_turns: request.max_turns, max_actions: request.max_actions, compact: true});
  let lastProgress = started;
  const channel = new MessageChannel();
  const yieldToMessages = () => new Promise(resolve => {
    channel.port1.onmessage = resolve;
    channel.port2.postMessage(null);
  });
  try {
    while (!result.done) {
      // MessageChannel yields without the nested-timer clamp on setTimeout.
      await yieldToMessages();
      if (cancelled()) return {cancelled: true};
      result = call({op: "step", count: 8, compact: true});
      const now = performance.now();
      if (!result.done && now - lastProgress >= 200) {
        progress({turns: result.turns, actions: result.actions});
        lastProgress = now;
      }
    }
    return {result, seconds: (performance.now() - started) / 1000, computeMs, calls};
  } finally {
    channel.port1.close();
    channel.port2.close();
  }
}
