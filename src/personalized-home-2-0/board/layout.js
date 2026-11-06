// All coordinates use grid units. UI code owns pixel measurement and size snapping.
const MAX_COLUMNS = 64;
const MAX_ITEMS = 1000;
const MAX_ITEM_HEIGHT = 128;
const MAX_ROWS = 100000;
const MODES = new Set(["compact", "free", "sections"]);

function columnsCount(columns) {
  if (!Number.isFinite(columns) || columns < 1 || columns > MAX_COLUMNS) {
    throw new RangeError(`columns must be between 1 and ${MAX_COLUMNS}`);
  }
  return Math.floor(columns);
}

function assertItems(items) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (items.length > MAX_ITEMS) throw new RangeError(`A board supports at most ${MAX_ITEMS} items`);
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("Each board item must be an object");
    }
  }
}

function integer(value, fallback) {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function height(value) {
  const result = Math.max(1, integer(value, 1));
  if (result > MAX_ITEM_HEIGHT) throw new RangeError(`Item height exceeds ${MAX_ITEM_HEIGHT} rows`);
  return result;
}

function row(value, h) {
  const result = Math.max(0, integer(value, 0));
  if (result + h > MAX_ROWS) throw new RangeError(`Board height exceeds ${MAX_ROWS} rows`);
  return result;
}

function rectangle(item, columns) {
  const w = Math.min(columns, Math.max(1, integer(item.w, 1)));
  const h = height(item.h);
  return {
    ...item,
    x: Math.min(columns - w, Math.max(0, integer(item.x, 0))),
    y: row(item.y, h),
    w,
    h,
  };
}

function normalize(items, columns, mode) {
  assertItems(items);
  if (!MODES.has(mode)) throw new RangeError(`Unknown layout mode: ${mode}`);
  const ids = new Set();
  return items.map((item) => {
    if ((typeof item.id !== "string" && typeof item.id !== "number") || item.id === "" || (typeof item.id === "number" && !Number.isFinite(item.id))) {
      throw new TypeError("Each board item needs a string or finite numeric id");
    }
    if (ids.has(item.id)) throw new RangeError(`Duplicate board item id: ${item.id}`);
    ids.add(item.id);
    if (item.type !== "shortcut" && item.type !== "widget") {
      throw new TypeError(`Unknown board item type: ${item.type}`);
    }
    return rectangle(item, columns);
  });
}

/** Edge-touching rectangles do not overlap. Invalid rectangles return false. */
export function overlaps(a, b) {
  if (![a, b].every((item) => item && [item.x, item.y, item.w, item.h].every(Number.isFinite) && item.w > 0 && item.h > 0)) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Jump over occupied vertical intervals instead of scanning unbounded empty rows.
function firstGap(items, x, w, h, minY) {
  const intervals = items
    .filter((item) => item.x < x + w && item.x + item.w > x && item.y + item.h > minY)
    .map((item) => [item.y, item.y + item.h])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let y = minY;
  for (const [top, bottom] of intervals) {
    if (top >= y + h) break;
    if (bottom > y) y = bottom;
  }
  return y + h <= MAX_ROWS ? y : null;
}

function vacancy(items, w, h, columns, preferred, minY = 0) {
  if (preferred) {
    const desired = rectangle({ ...preferred, w, h }, columns);
    desired.y = Math.max(minY, desired.y);
    if (desired.y + h <= MAX_ROWS && !items.some((item) => overlaps(item, desired))) {
      return { x: desired.x, y: desired.y };
    }
  }
  let best = null;
  for (let x = 0; x <= columns - w; x += 1) {
    const y = firstGap(items, x, w, h, minY);
    if (y !== null && (!best || y < best.y)) best = { x, y };
    if (best?.y === minY) break;
  }
  if (!best) throw new RangeError(`No vacancy within ${MAX_ROWS} board rows`);
  return best;
}

/** Prefer a supplied cell when available; otherwise choose the first row-major vacancy. */
export function firstVacancy(items = [], w = 1, h = 1, columns = 9, preferred) {
  const count = columnsCount(columns);
  assertItems(items);
  const normalized = items.map((item) => rectangle(item, count));
  const size = rectangle({ w, h }, count);
  return vacancy(normalized, size.w, size.h, count, preferred);
}

/** A trailing control follows the last content anchor, never an earlier gap. */
export function trailingVacancy(items = [], columns = 9) {
  const count = columnsCount(columns);
  assertItems(items);
  const normalized = items.map((item) => rectangle(item, count));
  if (!normalized.length) return { x: 0, y: 0 };
  const last = normalized.reduce((latest, item) =>
    item.y > latest.y || (item.y === latest.y && item.x > latest.x) ? item : latest);
  for (let x = last.x + 1; x < count; x += 1) {
    const cell = { x, y: last.y, w: 1, h: 1 };
    if (!normalized.some((item) => overlaps(item, cell))) return { x, y: last.y };
  }
  return vacancy(normalized, 1, 1, count, undefined, last.y + 1);
}

function boardRows(items) {
  return items.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0);
}

/** Empty boards occupy zero rows. Uses the same safe height/coordinate normalization. */
export function getBoardRows(items = []) {
  assertItems(items);
  return items.reduce((bottom, item) => {
    const h = height(item.h);
    return Math.max(bottom, row(item.y, h) + h);
  }, 0);
}

function putCompact(placed, item, columns, minY = 0) {
  const next = { ...item, ...vacancy(placed, item.w, item.h, columns, undefined, minY) };
  placed.push(next);
}

function putFree(placed, item) {
  const y = firstGap(placed, item.x, item.w, item.h, item.y);
  if (y === null) throw new RangeError(`No vacancy within ${MAX_ROWS} board rows`);
  placed.push({ ...item, y });
}

function restoreOrder(items, placed) {
  const positions = new Map(placed.map((item) => [item.id, item]));
  return items.map((item) => positions.get(item.id));
}

function arrange(items, columns, mode, anchor) {
  const placed = [];
  if (mode === "sections") {
    if (anchor?.type === "shortcut") placed.push(anchor);
    for (const item of items) {
      if (item.type === "shortcut" && item.id !== anchor?.id) putCompact(placed, item, columns);
    }
    const widgetStart = boardRows(placed);
    if (anchor?.type === "widget") {
      const y = Math.max(widgetStart, anchor.y);
      if (y + anchor.h > MAX_ROWS) throw new RangeError(`Board height exceeds ${MAX_ROWS} rows`);
      placed.push({ ...anchor, y });
    }
    for (const item of items) {
      if (item.type === "widget" && item.id !== anchor?.id) putCompact(placed, item, columns, widgetStart);
    }
  } else {
    if (anchor) placed.push(anchor);
    for (const item of items) {
      if (item.id === anchor?.id) continue;
      if (mode === "free") putFree(placed, item);
      else putCompact(placed, item, columns);
    }
  }
  return restoreOrder(items, placed);
}

/**
 * compact: stable row-major packing; free: preserve xy and push collisions downward;
 * sections: compact shortcuts first, then widgets below their final occupied row.
 * Returned order matches input order, including in sections mode.
 */
export function layoutItems(items = [], columns = 9, mode = "compact") {
  const count = columnsCount(columns);
  return arrange(normalize(items, count, mode), count, mode);
}

/**
 * Project the shared order into the earliest fitting cells. Keep the first item
 * anchored at the top left and the order of equal-sized items; later smaller
 * items may fill gaps beside wrapped widgets instead of leaving empty holes.
 * Input order and stored widget dimensions are not changed by projection.
 */
export function reflowBoardItems(items = [], columns = 9) {
  const count = columnsCount(columns);
  return arrange(normalize(items, count, "compact"), count, "compact");
}

/**
 * Fill earlier gaps in current visual row order, retaining the input array order.
 * An already dense layout is left in place: small items filling earlier gaps can
 * change visual order, so blindly repacking it on every render is not idempotent.
 */
export function compactBoardItems(items = [], columns = 9) {
  const count = columnsCount(columns);
  const normalized = normalize(items, count, "compact");
  const collision = normalized.some((item, index) =>
    normalized.slice(index + 1).some((other) => overlaps(item, other)));
  if (!collision && normalized.every((item) => {
    const earlier = vacancy(normalized.filter((other) => other.id !== item.id), item.w, item.h, count);
    return earlier.x === item.x && earlier.y === item.y;
  })) return normalized;

  const visualOrder = [...normalized].sort((a, b) => a.y - b.y || a.x - b.x);
  return restoreOrder(normalized, arrange(visualOrder, count, "compact"));
}

function changeItem(items, id, change, columns, mode) {
  const count = columnsCount(columns);
  const normalized = normalize(items, count, mode);
  const current = normalized.find((item) => item.id === id);
  if (!current) return arrange(normalized, count, mode);
  const anchor = rectangle({ ...current, ...change }, count);
  const next = normalized.map((item) => item.id === id ? anchor : item);
  return arrange(next, count, mode, anchor);
}

/** The moved item has priority; sections constrains widgets below the shortcut region. */
export function moveItem(items = [], id, x, y, columns = 9, mode = "compact") {
  return changeItem(items, id, { x, y }, columns, mode);
}

/** Direct dragging swaps exact same-size targets; other drops retain free placement. */
export function moveBoardItem(items = [], id, x, y, columns = 9) {
  const count = columnsCount(columns);
  const normalized = normalize(items, count, "free");
  const current = normalized.find((item) => item.id === id);
  if (!current) return arrange(normalized, count, "free");
  const anchor = rectangle({ ...current, x, y }, count);
  const target = normalized.find((item) => item.id !== id
    && item.x === anchor.x && item.y === anchor.y
    && item.w === anchor.w && item.h === anchor.h);
  const next = normalized.map((item) => item.id === id ? anchor : item);

  if (target) {
    const swapped = next.map((item) => item.id === target.id
      ? { ...item, x: current.x, y: current.y }
      : item);
    // A stored or projected layout may already overlap. Do not preserve those
    // collisions by taking the swap shortcut; let free placement repair them.
    const collision = swapped.some((item, index) =>
      swapped.slice(index + 1).some((other) => overlaps(item, other)));
    if (!collision) return swapped;
  }

  return arrange(next, count, "free", anchor);
}

/** Call with grid dimensions already snapped by the UI; the resized item has priority. */
export function resizeItem(items = [], id, w, h, columns = 9, mode = "compact") {
  return changeItem(items, id, { w, h }, columns, mode);
}

/** Preserve direct-drag swap semantics, then close any newly vacant grid cells. */
export function movePackedBoardItem(items = [], id, x, y, columns = 9) {
  return compactBoardItems(moveBoardItem(items, id, x, y, columns), columns);
}

/** Apply the snapped size with collision priority, then close newly vacant cells. */
export function resizePackedBoardItem(items = [], id, w, h, columns = 9) {
  return compactBoardItems(resizeItem(items, id, w, h, columns, "free"), columns);
}
