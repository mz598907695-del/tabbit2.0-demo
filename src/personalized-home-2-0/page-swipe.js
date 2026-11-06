export const PAGE_SWIPE_IDLE_MS = 80;
export const PAGE_SWIPE_RESET_MS = 240;
export const PAGE_SWIPE_MIN_INTERVAL_MS = 100;

// wheel has no reliable finger-up event. Separate a change of direction, a
// fresh burst, and a protected gesture instead of locking an entire wheel stream.
export function createPageSwipeGesture({ threshold = 24, flickDistance = Infinity, flickVelocity = 1.2, idleMs = PAGE_SWIPE_IDLE_MS, resetMs = PAGE_SWIPE_RESET_MS, commitOnRelease = false } = {}) {
  let gesture = null;
  const axisRatio = 1.2;
  const meaningfulDelta = 3;

  function reset() {
    gesture = null;
  }

  function start(now) {
    return {
      lastTime: now, axis: null, distance: 0, turnEvents: 0,
      verticalSince: null, verticalDistance: 0, verticalEvents: 0, verticalTurn: false,
      fired: 0, firedAt: -Infinity, poisoned: false,
      reverseDistance: 0, reverseEvents: 0, restart: null,
      samples: [], velocity: 0, lastAmount: 0, peak: 0, lowSince: null, lowReady: false, lowSpeed: Infinity, attack: null,
    };
  }

  function fire(direction, now, velocity, preview = direction) {
    gesture.fired = direction;
    gesture.firedAt = now;
    gesture.distance = 0;
    gesture.reverseDistance = 0;
    gesture.reverseEvents = 0;
    gesture.restart = null;
    gesture.peak = velocity;
    gesture.lowSince = null;
    gesture.lowReady = false;
    gesture.lowSpeed = Infinity;
    gesture.attack = null;
    return { capture: true, direction, preview };
  }

  function feed(event, now, blocked = false) {
    const x = event.deltaX;
    const y = event.deltaY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) return { capture: false, direction: 0 };

    const gap = gesture ? now - gesture.lastTime : Infinity;
    if (!gesture || gap >= resetMs) gesture = start(now);
    gesture.lastTime = now;

    // Neither a short gap, a reversal nor acceleration can bypass input/IME,
    // overlay ownership, pinch zoom or another listener's claim of this stream.
    if (blocked || event.defaultPrevented || !event.cancelable || event.deltaMode !== 0
      || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) gesture.poisoned = true;
    if (gesture.poisoned) return { capture: false, direction: 0 };

    const amount = Math.abs(x);
    const direction = Math.sign(x);
    // Once horizontal ownership is established, tolerate diagonal noise while
    // the fingers slow down. A deliberate vertical turn still releases it.
    const horizontal = amount > axisRatio * Math.abs(y)
      || (gesture.axis === 'x' && amount > 0 && Math.abs(y) < Math.max(24, amount * 3));
    const vertical = Math.abs(y) > axisRatio * amount;
    if (!horizontal) {
      gesture.reverseDistance = 0;
      gesture.reverseEvents = 0;
      gesture.restart = null;
      gesture.attack = null;
      if (vertical && Math.abs(y) >= meaningfulDelta) {
        if (gesture.verticalSince === null) gesture.verticalSince = now;
        gesture.verticalDistance += Math.abs(y);
        gesture.verticalEvents += 1;
        if (now - gesture.verticalSince >= PAGE_SWIPE_MIN_INTERVAL_MS
          && gesture.verticalEvents >= 3 && gesture.verticalDistance >= 48) gesture.verticalTurn = true;
        if (gesture.axis !== 'x' || gesture.verticalTurn) {
          gesture.axis = 'y';
          gesture.distance = 0;
          gesture.turnEvents = 0;
        }
      }
      // Only an intentional vertical turn cancels the visible preview.
      return { capture: false, direction: 0, cancel: gesture.verticalTurn };
    }

    if (amount >= meaningfulDelta) {
      if (gesture.verticalTurn) {
        // Sustained native vertical scrolling ended the old horizontal intention.
        // Re-enter horizontal recognition without carrying its stale speed/latch.
        gesture.fired = 0;
        gesture.samples = [];
        gesture.velocity = 0;
        gesture.lastAmount = 0;
        gesture.peak = 0;
        gesture.lowSince = null;
        gesture.lowReady = false;
        gesture.lowSpeed = Infinity;
      }
      gesture.verticalSince = null;
      gesture.verticalDistance = 0;
      gesture.verticalEvents = 0;
      gesture.verticalTurn = false;
    }

    // Judge speed over several samples, so a coalesced wheel event is not by
    // itself evidence that the user has started another swipe.
    const previousVelocity = gesture.velocity;
    const previousAmount = gesture.lastAmount;
    // A fresh intention re-arms immediately; only a continuing momentum tail
    // stays latched. Do not make a second swipe wait for the old stream timeout.
    if (gesture.fired && direction !== gesture.fired && amount >= meaningfulDelta) {
      gesture.reverseDistance += amount;
      gesture.reverseEvents += 1;
    } else if (direction === gesture.fired) {
      gesture.reverseDistance = 0;
      gesture.reverseEvents = 0;
    }
    const reversing = (gesture.reverseEvents >= 2 && gesture.reverseDistance >= 18) || (direction !== gesture.fired && amount >= 48);
    const freshBurst = gap >= idleMs && amount >= meaningfulDelta;
    const newImpulse = amount >= Math.max(previousAmount * 1.6, previousAmount + 6)
      && previousVelocity <= gesture.peak * .65;
    if (gesture.fired && (reversing || freshBurst || newImpulse)) {
      gesture = start(now);
      return feed(event, now, false);
    }
    gesture.lastAmount = amount;
    gesture.samples = gesture.samples.filter(sample => now - sample.time <= 50);
    gesture.samples.push({ time: now, amount });
    const velocity = gesture.samples.reduce((sum, sample) => sum + sample.amount, 0)
      / Math.max(16, now - gesture.samples[0].time + 16);
    gesture.velocity = velocity;
    gesture.peak = Math.max(gesture.peak, velocity);

    if (!gesture.fired) {
      // A real vertical-to-horizontal turn is a new intention. Tiny cross-axis
      // noise is captured but cannot establish that turn or accumulate a page.
      if (gesture.axis === 'y') {
        if (amount < meaningfulDelta) return { capture: true, direction: 0 };
        gesture.distance += x;
        gesture.turnEvents += 1;
        if (gesture.turnEvents < 2 && amount < threshold) return { capture: true, direction: 0 };
        gesture.axis = 'x';
      } else {
        gesture.axis = 'x';
        gesture.distance += x;
      }
      if (!commitOnRelease && Math.abs(gesture.distance) >= threshold) return fire(Math.sign(gesture.distance), now, velocity);
      // Fast short flicks commit by intent, then animate the remaining distance.
      if (!commitOnRelease && Math.abs(gesture.distance) >= flickDistance && velocity >= flickVelocity) {
        return fire(Math.sign(gesture.distance), now, velocity, gesture.distance / threshold);
      }
      return { capture: true, direction: 0, preview: gesture.distance / threshold };
    }

    const intervalReady = now - gesture.firedAt >= PAGE_SWIPE_MIN_INTERVAL_MS;
    if (direction !== gesture.fired) {
      gesture.restart = null;
      gesture.attack = null;
      if (amount >= meaningfulDelta) {
        if (intervalReady && gesture.reverseDistance >= threshold
          && (gesture.reverseEvents >= 2 || amount >= threshold * 1.5)) return fire(direction, now, velocity);
      }
      return { capture: true, direction: 0 };
    }
    gesture.reverseDistance = 0;
    gesture.reverseEvents = 0;

    // An 80ms pause invites re-evaluation, not an unconditional reset. Require
    // two close samples; sparse momentum with repeated 80ms gaps cannot repeat.
    if (gap >= idleMs) gesture.restart = {
      start: now, distance: 0, events: 0, first: amount,
      accelerating: amount >= Math.max(previousAmount * 1.35, previousAmount + meaningfulDelta),
    };
    if (gesture.restart) {
      if (now - gesture.restart.start > idleMs) gesture.restart = null;
      else if (amount >= meaningfulDelta) {
        gesture.restart.distance += amount;
        gesture.restart.events += 1;
        gesture.restart.accelerating ||= amount >= Math.max(gesture.restart.first * 1.35, gesture.restart.first + meaningfulDelta);
        if (intervalReady && gesture.restart.accelerating && gesture.restart.events >= 2
          && gesture.restart.distance >= threshold) return fire(direction, now, velocity);
      }
    }

    // Same-direction re-engagement may occur before momentum becomes silent.
    // First see a sustained decay, then two useful accelerating samples. A
    // continuous fast swipe or a monotonically fading tail stays one page.
    gesture.peak = Math.max(gesture.peak, velocity);
    if (velocity <= gesture.peak * .35) {
      if (gesture.lowSince === null) gesture.lowSince = now;
      gesture.lowSpeed = Math.min(gesture.lowSpeed, velocity);
      if (now - gesture.lowSince >= 40) gesture.lowReady = true;
    } else if (!gesture.lowReady) {
      gesture.lowSince = null;
      gesture.lowSpeed = Infinity;
    }
    if (gesture.lowReady && amount >= meaningfulDelta) {
      if (!gesture.attack && velocity > gesture.lowSpeed * 1.2 && velocity > previousVelocity * 1.15) {
        gesture.attack = { start: now, distance: 0, events: 0 };
      }
      if (gesture.attack) {
        if (now - gesture.attack.start > idleMs || velocity < gesture.lowSpeed * 1.2) gesture.attack = null;
        else {
          gesture.attack.distance += amount;
          gesture.attack.events += 1;
          if (intervalReady && gesture.attack.events >= 2 && gesture.attack.distance >= threshold
            && velocity >= Math.max(.22, gesture.lowSpeed * 2.5)) return fire(direction, now, velocity);
        }
      }
    }
    return { capture: true, direction: 0 };
  }

  function finish() {
    if (!gesture || gesture.poisoned || gesture.axis !== 'x') {
      reset();
      return { capture: false, direction: 0, preview: 0 };
    }
    const distance = gesture.distance;
    const releaseSpeed = Math.max(gesture.velocity, gesture.peak * .65);
    const projectedDistance = Math.abs(distance) + releaseSpeed * 140;
    const projectedCommit = Math.abs(distance) >= flickDistance
      && releaseSpeed >= flickVelocity
      && projectedDistance >= threshold;
    const direction = Math.abs(distance) >= threshold || projectedCommit ? Math.sign(distance) : 0;
    reset();
    return { capture: true, direction, preview: distance / threshold, projectedDistance, releaseSpeed };
  }

  return { feed, finish, reset };
}
