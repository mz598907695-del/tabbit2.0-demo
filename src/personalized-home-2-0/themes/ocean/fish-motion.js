const STEP = 1 / 60;
const HORIZONTAL_BLEND = 1 - Math.exp(-2.4 * STEP);
const VERTICAL_BLEND = 1 - Math.exp(-1.6 * STEP);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const sample = random => clamp(finite(random(), .5), 0, .999999999);

// Each fish owns a tiny PRNG. Only course changes consume it, so animation
// frames do not allocate objects or draw random numbers, and pausing is exact.
function randomFor(fish) {
  let n = fish._seed;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  fish._seed = n >>> 0;
  return fish._seed / 4294967296;
}

/** Create stable individual swimmers from normalized population x/y entries. */
export function createFishSwimmers(population, random = Math.random) {
  return population.map((source, index) => {
    const seed = Math.floor(sample(random) * 4294967295) || index + 1;
    const sizeScale = .9 + sample(random) * .22;
    const speed = 18 + sample(random) * 20;
    const direction = source.direction === -1 ? -1 : 1;
    return {
      id: source.id,
      u: clamp(finite(source.x, .5), 0, 1),
      v: clamp(finite(source.y, .65), 0, 1),
      x: 0, y: 0, width: 0, height: 0,
      direction, facing: direction, sizeScale,
      _baseWidth: Math.max(1, finite(source.width, 100)),
      _seed: seed, _speed: speed, _visualSpeed: speed, _heading: direction,
      _decisionIn: 5 + sample(random) * 7,
      _targetV: clamp(finite(source.y, .65) + (sample(random) - .5) * .16, .05, .95),
      _vx: direction * speed, _vy: 0, _accumulator: 0, _viewWidth: 0, _viewHeight: 0,
    };
  });
}

/** Resume from the rendered hook/release heading, not the pre-bite velocity. */
export function resumeFishSwimmer(swimmer, { direction = swimmer.direction, facing = swimmer.facing } = {}) {
  const heading = direction < 0 ? -1 : 1;
  const renderedFacing = clamp(finite(facing, heading), -1, 1);
  const speed = Math.max(1, finite(swimmer._visualSpeed, finite(swimmer._speed, 28)));
  swimmer._heading = heading;
  swimmer._visualSpeed = speed;
  // This is the inverse of the normal velocity-to-facing mapping. A partial
  // side-on turn stays partial on the next step rather than flashing backward.
  swimmer._vx = renderedFacing * Math.max(10, speed * .65);
  swimmer.direction = swimmer._vx === 0 ? heading : swimmer._vx < 0 ? -1 : 1;
  swimmer.facing = renderedFacing;
  return swimmer;
}

/**
 * Mutate swimmers in place; dt is seconds. Coordinates are local to the ocean
 * viewport. The owner may pass dt=0 for overlays/hidden fish, or reducedMotion
 * for static fish. Geometry changes still remap their normalized positions.
 * pinnedIndex freezes a hooked/released fish's route clock; the owner may
 * synchronize that fish's x/y/u/v to its hook position before releasing it.
 */
export function stepFishSwimmers(swimmers, dt, { width, height, waterY, reducedMotion = false, pinnedIndex = -1 }) {
  const viewWidth = Math.max(1, finite(width, 1));
  const viewHeight = Math.max(1, finite(height, 1));
  const surface = finite(waterY, 0);
  // A delayed frame never catches up a hidden tab's entire elapsed time.
  const elapsed = reducedMotion ? 0 : clamp(finite(dt, 0), 0, .1);
  const speedScale = clamp(viewWidth / 1100, .85, 1.18);

  for (let i = 0; i < swimmers.length; i += 1) {
    const fish = swimmers[i];
    fish.width = Math.min(fish._baseWidth * fish.sizeScale, viewWidth * .27, viewHeight * .65);
    fish.height = fish.width * .64;
    const halfW = fish.width / 2, halfH = fish.height / 2;
    const inset = Math.min(16, viewWidth * .04);
    const minX = Math.min(viewWidth / 2, halfW + inset);
    const maxX = Math.max(minX, viewWidth - halfW - inset);
    const bottomSpace = Math.min(80, viewHeight * .22);
    const maxY = Math.max(halfH, viewHeight - bottomSpace - halfH);
    const minY = Math.min(maxY, Math.max(halfH + 12, surface + halfH + 12));

    fish.x = clamp(fish._viewWidth === viewWidth ? fish.x : fish.u * viewWidth, minX, maxX);
    fish.y = clamp(fish._viewHeight === viewHeight ? fish.y : fish.v * viewHeight, minY, maxY);
    fish._viewWidth = viewWidth;
    fish._viewHeight = viewHeight;
    fish._accumulator += i === pinnedIndex ? 0 : elapsed;
    while (fish._accumulator + 1e-10 >= STEP) {
      fish._accumulator = Math.max(0, fish._accumulator - STEP);
      fish._decisionIn -= STEP;
      if (fish._decisionIn <= 0) {
        fish._heading = randomFor(fish) < .5 ? -1 : 1;
        fish._speed = 18 + randomFor(fish) * 20;
        fish._targetV = clamp(fish.v + (randomFor(fish) - .5) * .22, .05, .95);
        fish._decisionIn += 5 + randomFor(fish) * 7;
      }

      // Turn before the edge, leaving room to decelerate through zero. This
      // avoids a hard reflection, wraparound, or an offscreen respawn.
      const turnMargin = Math.min((maxX - minX) * .3, Math.max(24, Math.abs(fish._vx) * .85));
      if (fish.x <= minX + turnMargin) fish._heading = 1;
      else if (fish.x >= maxX - turnMargin) fish._heading = -1;
      const desiredVX = fish._heading * fish._speed * speedScale;
      const targetY = clamp(fish._targetV * viewHeight, minY, maxY);
      const desiredVY = clamp((targetY - fish.y) * .18, -7, 7);
      const oldVX = fish._vx, oldVY = fish._vy;
      fish._vx += (desiredVX - fish._vx) * HORIZONTAL_BLEND;
      fish._vy += (desiredVY - fish._vy) * VERTICAL_BLEND;
      fish._visualSpeed += (fish._speed * speedScale - fish._visualSpeed) * HORIZONTAL_BLEND;
      fish.x = clamp(fish.x + (oldVX + fish._vx) * .5 * STEP, minX, maxX);
      fish.y = clamp(fish.y + (oldVY + fish._vy) * .5 * STEP, minY, maxY);
      fish.direction = fish._vx < 0 ? -1 : 1;
      fish.facing = clamp(fish._vx / Math.max(10, fish._visualSpeed * .65), -1, 1);
      fish.u = fish.x / viewWidth;
      fish.v = fish.y / viewHeight;
    }
    fish.u = fish.x / viewWidth;
    fish.v = fish.y / viewHeight;
  }
  return swimmers;
}
