import { trailingVacancy, overlaps } from './layout.js';

/** The Add control is a tool, not a participant in the drag's packing preview. */
export function boardAddPosition(placed, columns, gesture = null) {
  const point = trailingVacancy(gesture?.originalPlaced || placed, columns);
  const cell = { ...point, w: 1, h: 1 };
  return {
    ...point,
    obscured: Boolean(gesture?.moved && gesture.placed.some(item => overlaps(item, cell))),
  };
}
