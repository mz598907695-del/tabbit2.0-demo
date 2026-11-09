/** Coalesce visual state writes; interaction/geometry still runs for every input.
 * Cancellation drops the pending preview before commit, escape or unmount. */
export function createFrameBatch(paint, host = window) {
  let frame = null;
  let latest;
  return {
    schedule(value) {
      latest = value;
      if (frame !== null) return;
      frame = host.requestAnimationFrame(() => {
        frame = null;
        const value = latest;
        latest = undefined;
        paint(value);
      });
    },
    cancel() {
      if (frame !== null) host.cancelAnimationFrame(frame);
      frame = null;
      latest = undefined;
    },
  };
}
