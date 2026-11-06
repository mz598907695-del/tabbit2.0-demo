// Screen-space fishing: gravity acts down (+y), distances are CSS pixels and
// time is seconds. The hook owns the trajectory; the rope never invents one.
const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.1;
const NODE_COUNT = 28;
const EPSILON = 1e-7;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const position = (value, fallback) => ({
  x: finite(value?.x, fallback.x),
  y: finite(value?.y, fallback.y),
});

/**
 * Creates a released cast. Animate a short rod backswing before calling this.
 * target.x is the landing aim; waterY is the surface, and target.y is the
 * underwater resting destination. Exposed points can be drawn as a polyline.
 */
export function createFishingSimulation({ origin, target, waterY, gravity = 900 } = {}) {
  const start = position(origin, { x: 0, y: 0 });
  const aim = position(target, { x: start.x + 300, y: start.y + 300 });
  const surface = finite(waterY, start.y + 200);
  const g = clamp(finite(gravity, 900), 1, 10000);
  const dx = aim.x - start.x;
  const rise = Math.max(clamp(Math.abs(dx) * 0.22, 44, 145), start.y - surface + 24);
  const riseTime = Math.sqrt(2 * rise / g);
  const fallTime = Math.sqrt(2 * Math.max(0, surface - start.y + rise) / g);
  const flightTime = riseTime + fallTime;
  const underwater = start.y >= surface;
  const hook = { x: start.x, y: start.y, vx: underwater ? 0 : dx / flightTime, vy: underwater ? 0 : -g * riseTime };
  return {
    hook,
    points: Array.from({ length: NODE_COUNT }, () => ({ x: start.x, y: start.y, previousX: start.x, previousY: start.y })),
    origin: start,
    target: aim,
    waterY: surface,
    gravity: g,
    phase: underwater ? 'underwater' : 'casting',
    elapsed: 0,
    underwaterTime: 0,
    flightTime,
    lineLength: 0,
    segmentLength: 0,
    // Set once at the exact water crossing, not at a precomputed animation time.
    splash: null,
    accumulator: 0,
    reeling: false,
  };
}

// Exact critically damped step preserves incoming velocity at water entry and
// makes moving scroll/reeling destinations independent of the render rate.
function dampedAxis(value, velocity, destination, omega, dt) {
  const offset = value - destination;
  const impulse = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return [(offset + impulse * dt) * decay + destination, (velocity - omega * impulse * dt) * decay];
}

function stepUnderwater(sim, dt) {
  if (dt <= 0) return;
  const omega = sim.reeling ? 8 : 3.6;
  const [x, vx] = dampedAxis(sim.hook.x, sim.hook.vx, sim.target.x, omega, dt);
  const [y, vy] = dampedAxis(sim.hook.y, sim.hook.vy, sim.target.y, omega, dt);
  sim.hook.x = x;
  sim.hook.y = y;
  sim.hook.vx = vx;
  sim.hook.vy = vy;
  sim.underwaterTime += dt;
}

function stepHook(sim, dt) {
  if (sim.phase === 'underwater') {
    stepUnderwater(sim, dt);
    return;
  }
  const hook = sim.hook;
  const nextY = hook.y + hook.vy * dt + 0.5 * sim.gravity * dt * dt;
  // Catch only a downward crossing. Solve within the substep so the splash,
  // rope endpoint and rendered hook all agree even at a low frame rate.
  if (nextY >= sim.waterY && hook.vy + sim.gravity * dt > 0) {
    const discriminant = hook.vy * hook.vy + 2 * sim.gravity * (sim.waterY - hook.y);
    const crossingTime = clamp((-hook.vy + Math.sqrt(Math.max(0, discriminant))) / sim.gravity, 0, dt);
    hook.x += hook.vx * crossingTime;
    hook.y = sim.waterY;
    hook.vy += sim.gravity * crossingTime;
    sim.splash = { x: hook.x, y: hook.y, at: sim.elapsed + crossingTime };
    sim.phase = 'underwater';
    stepUnderwater(sim, dt - crossingTime);
    return;
  }
  hook.x += hook.vx * dt;
  hook.y = nextY;
  hook.vy += sim.gravity * dt;
}

function pinEnds(sim) {
  const first = sim.points[0];
  const last = sim.points[sim.points.length - 1];
  first.x = sim.origin.x;
  first.y = sim.origin.y;
  last.x = sim.hook.x;
  last.y = sim.hook.y;
}

function constrainPair(points, index, segmentLength) {
  const a = points[index];
  const b = points[index + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPSILON) return;
  const aWeight = index === 0 ? 0 : 1;
  const bWeight = index === points.length - 2 ? 0 : 1;
  const correction = (distance - segmentLength) / (distance * (aWeight + bWeight));
  a.x += dx * correction * aWeight;
  a.y += dy * correction * aWeight;
  b.x -= dx * correction * bWeight;
  b.y -= dy * correction * bWeight;
}

function stepRope(sim, dt) {
  const points = sim.points;
  const chord = Math.hypot(sim.hook.x - sim.origin.x, sim.hook.y - sim.origin.y);
  const firstPayout = sim.lineLength < EPSILON;
  const desiredLength = sim.reeling ? chord + Math.min(1, chord * 0.006) : chord * 1.035 + Math.min(14, chord * 0.04);
  // Free payout keeps a casting weight ballistic. A fixed node budget samples
  // the increasing visible line; nodes are samples, not fixed material markers.
  if (sim.phase === 'casting') sim.lineLength = Math.max(sim.lineLength, desiredLength);
  else sim.lineLength += (desiredLength - sim.lineLength) * (1 - Math.exp(-8 * dt));
  sim.lineLength = Math.max(chord * 1.001, sim.lineLength);
  sim.segmentLength = sim.lineLength / (points.length - 1);

  // The first released centimetres did not exist in the previous sample.
  // Seed them along the outgoing direction, with proportional launch velocity,
  // instead of asking the constraint solver to unfold 28 coincident nodes.
  if (firstPayout) {
    for (let i = 1; i < points.length - 1; i += 1) {
      const fraction = i / (points.length - 1);
      const point = points[i];
      point.x = sim.origin.x + (sim.hook.x - sim.origin.x) * fraction;
      point.y = sim.origin.y + (sim.hook.y - sim.origin.y) * fraction;
      point.previousX = point.x - sim.hook.vx * dt * fraction;
      point.previousY = point.y - sim.hook.vy * dt * fraction;
    }
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    if (firstPayout) break;
    const point = points[i];
    const oldX = point.x;
    const oldY = point.y;
    const drag = point.y >= sim.waterY ? 0.94 : 0.988;
    point.x += (point.x - point.previousX) * drag;
    point.y += (point.y - point.previousY) * drag + sim.gravity * 0.4 * dt * dt;
    point.previousX = oldX;
    point.previousY = oldY;
  }
  pinEnds(sim);
  // Forward/back sweeps avoid a directional solver bias and keep both the
  // guide and hook anchored. There is no allocation as depth increases.
  for (let iteration = 0; iteration < 12; iteration += 1) {
    for (let i = 0; i < points.length - 1; i += 1) constrainPair(points, i, sim.segmentLength);
    for (let i = points.length - 2; i >= 0; i -= 1) constrainPair(points, i, sim.segmentLength);
  }
  pinEnds(sim);
}

/** Mutates and returns sim. dt is seconds; a hidden-tab gap is not caught up. */
export function stepFishingSimulation(sim, dt, options = {}) {
  if (options.origin) sim.origin = position(options.origin, sim.origin);
  if (options.target) sim.target = position(options.target, sim.target);
  sim.waterY = finite(options.waterY, sim.waterY);
  if (typeof options.reeling === 'boolean') sim.reeling = options.reeling;
  sim.accumulator += clamp(finite(dt, 0), 0, MAX_FRAME_TIME);
  let steps = 0;
  while (sim.accumulator + EPSILON >= FIXED_STEP && steps < 12) {
    stepHook(sim, FIXED_STEP);
    stepRope(sim, FIXED_STEP);
    sim.elapsed += FIXED_STEP;
    sim.accumulator = Math.max(0, sim.accumulator - FIXED_STEP);
    steps += 1;
  }
  return sim;
}

/**
 * Move the camera coordinate frame without injecting energy into the rope.
 * Pass the same screen-space translation applied to the ocean / rod artwork.
 * Subsequent target/waterY options should use the newly translated frame.
 */
export function translateFishingSimulation(sim, dx, dy) {
  const x = finite(dx, 0);
  const y = finite(dy, 0);
  for (const point of sim.points) {
    point.x += x;
    point.y += y;
    point.previousX += x;
    point.previousY += y;
  }
  sim.origin.x += x;
  sim.origin.y += y;
  sim.target.x += x;
  sim.target.y += y;
  sim.hook.x += x;
  sim.hook.y += y;
  sim.waterY += y;
  if (sim.splash) {
    sim.splash.x += x;
    sim.splash.y += y;
  }
  return sim;
}

function measureLine(sim) {
  let length = 0;
  for (let i = 1; i < sim.points.length; i += 1) {
    length += Math.hypot(sim.points[i].x - sim.points[i - 1].x, sim.points[i].y - sim.points[i - 1].y);
  }
  sim.lineLength = length;
  sim.segmentLength = length / (sim.points.length - 1);
}

/**
 * Reframe a live cast after a viewport resize. Current and previous Verlet
 * samples share the same affine mapping, so resizing adds no artificial kick.
 * Vertical gravity scales as well to preserve the remaining flight timing.
 */
export function resizeFishingSimulation(sim, { origin, scaleX = 1, scaleY = 1 } = {}) {
  const oldOrigin = sim.origin;
  const nextOrigin = position(origin, oldOrigin);
  const sx = clamp(finite(scaleX, 1), 0.1, 10);
  const sy = clamp(finite(scaleY, 1), 0.1, 10);
  const mapX = x => nextOrigin.x + (x - oldOrigin.x) * sx;
  const mapY = y => nextOrigin.y + (y - oldOrigin.y) * sy;
  for (const point of sim.points) {
    point.x = mapX(point.x);
    point.y = mapY(point.y);
    point.previousX = mapX(point.previousX);
    point.previousY = mapY(point.previousY);
  }
  sim.hook.x = mapX(sim.hook.x);
  sim.hook.y = mapY(sim.hook.y);
  sim.hook.vx *= sx;
  sim.hook.vy *= sy;
  sim.target.x = mapX(sim.target.x);
  sim.target.y = mapY(sim.target.y);
  sim.waterY = mapY(sim.waterY);
  sim.gravity *= sy;
  if (sim.splash) {
    sim.splash.x = mapX(sim.splash.x);
    sim.splash.y = mapY(sim.splash.y);
  }
  sim.origin = nextOrigin;
  pinEnds(sim);
  measureLine(sim);
  return sim;
}

/** Static reduced-motion pose: endpoints are exact and all stored velocity is zero. */
export function settleFishingSimulation(sim, { origin, target, waterY } = {}) {
  sim.origin = position(origin, sim.origin);
  sim.target = position(target, sim.target);
  sim.waterY = finite(waterY, sim.waterY);
  sim.hook.x = sim.target.x;
  sim.hook.y = sim.target.y;
  sim.hook.vx = 0;
  sim.hook.vy = 0;
  const dx = sim.hook.x - sim.origin.x;
  const dy = sim.hook.y - sim.origin.y;
  const sag = Math.min(20, Math.hypot(dx, dy) * 0.035);
  for (let i = 0; i < sim.points.length; i += 1) {
    const fraction = i / (sim.points.length - 1);
    const point = sim.points[i];
    point.x = sim.origin.x + dx * fraction;
    point.y = sim.origin.y + dy * fraction + Math.sin(Math.PI * fraction) * sag;
  }
  pinEnds(sim);
  for (const point of sim.points) {
    point.previousX = point.x;
    point.previousY = point.y;
  }
  measureLine(sim);
  sim.phase = 'underwater';
  sim.splash = null;
  sim.accumulator = 0;
  sim.underwaterTime = 0;
  sim.reeling = false;
  return sim;
}
