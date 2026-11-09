import { useEffect, useLayoutEffect, useRef } from 'react';
import { createSpaceAppearanceTransition } from './spaceAppearanceTransition';

export function useSpaceAppearanceTransition(spaceId, mode) {
  const latest = useRef(null), controller = useRef(null);
  latest.current = { spaceId, mode };
  useEffect(() => {
    const transition = createSpaceAppearanceTransition({ getCurrent:() => latest.current });
    controller.current = transition;
    return () => { transition.destroy(); controller.current = null; };
  }, []);
  useLayoutEffect(() => { controller.current?.handoff(); }, [spaceId, mode]);
}
