export const SPACE_CONTENT_DURATION = 240;
export const SPACE_TRANSITION_EVENT = "tabbit-space-transition-progress";
export type SpaceTransitionProgress = { spaceId: string; progress: number };

export function publishSpaceTransition(spaceId: number, progress: number) {
  window.dispatchEvent(new CustomEvent<SpaceTransitionProgress>(SPACE_TRANSITION_EVENT, {
    detail: { spaceId: String(spaceId), progress },
  }));
}

export const SPACE_GESTURE_EVENT = 'tabbit-space-gesture-progress';
export type SpaceGestureProgress = { fromSpaceId:string; toSpaceId:string; progress:number };
export function publishSpaceGesture(detail:SpaceGestureProgress | null) {
  window.dispatchEvent(new CustomEvent<SpaceGestureProgress | null>(SPACE_GESTURE_EVENT, {detail}));
}
