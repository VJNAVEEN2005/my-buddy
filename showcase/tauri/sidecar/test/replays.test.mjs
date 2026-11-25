// Kept walkthroughs (replays.mjs): what can be kept, and matching the same ask in the same app. Run: npm test
import assert from 'node:assert/strict';
import { askKey, replayable } from '../replays.mjs';

assert.equal(askKey('Hey Buddy, how do I add a chart?'), 'how do i add a chart');
assert.equal(askKey('how do I add a CHART'), 'how do i add a chart');
assert.equal(askKey('  my buddy:  export as PDF!! '), 'export as pdf');

const walk = { target: 'front', beats: [
  { say: 'Click Insert.', marks: [{ kind: 'target', at: { text: 'Insert' }, label: 'Insert' }], wait: 'click' },
  { say: 'Now Chart.', marks: [{ kind: 'target', at: { text: 'Chart' } }], wait: 'click' },
] };
assert.equal(replayable(walk), true);
// Not a walkthrough: nothing waits for a click.
assert.equal(replayable({ beats: walk.beats.map((b) => ({ ...b, wait: undefined })) }), false);
// Pixels or read_window ids go stale.
assert.equal(replayable({ beats: [{ say: 'Here.', marks: [{ kind: 'target', at: { x: 10, y: 20, w: 5, h: 5 } }], wait: 'click' }] }), false);
assert.equal(replayable({ beats: [{ say: 'Here.', marks: [{ kind: 'target', at: { id: 4 } }], wait: 'click' }] }), false);
// Cards and actions (typing) aren't replayed.
assert.equal(replayable({ beats: [{ say: 'Type it.', marks: [{ kind: 'type', at: { text: 'Name' }, text: 'x' }], wait: 'click' }] }), false);
assert.equal(replayable({ beats: [{ say: 'See.', marks: [{ kind: 'card', title: 'x' }], wait: 'click' }] }), false);
assert.equal(replayable(null), false);
console.log('replays ok');
