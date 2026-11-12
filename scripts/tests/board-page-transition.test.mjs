import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_PAGE_GAP, boardPageTravel, boardPageFade } from '../../src/personalized-home-2-0/board/board-page-transition.js';

test('page travel spans the viewport and leaves a separate gap between pages', () => {
  assert.equal(boardPageTravel(1280), 1280 + BOARD_PAGE_GAP);
  assert.equal(boardPageTravel(800) - 800, BOARD_PAGE_GAP);
});
test('incoming content fades in gradually and is fully visible before landing', () => {
  assert.deepEqual(boardPageFade(0, 1000), { incoming: 0, outgoing: 1 });
  const early = boardPageFade(50, 1000), middle = boardPageFade(300, 1000);
  assert.ok(early.incoming > 0 && early.incoming < middle.incoming && middle.incoming < 1);
  assert.equal(boardPageFade(600, 1000).incoming, 1);
  assert.deepEqual(boardPageFade(1000, 1000), { incoming: 1, outgoing: 0 });
  assert.deepEqual(boardPageFade(-1, 1000), { incoming: 0, outgoing: 1 });
});
