import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const contract = require('../packages/contract/dist/cjs/index.js');

const statuses = new Set(contract.ORDER_STATUSES);
assert(statuses.size > 0, 'ORDER_STATUSES must not be empty');
assert.deepEqual(
  Object.keys(contract.ORDER_TRANSITIONS).sort(),
  [...statuses].sort(),
  'ORDER_TRANSITIONS must define every order status exactly once',
);

for (const [from, transitions] of Object.entries(contract.ORDER_TRANSITIONS)) {
  const targets = new Set();
  for (const transition of transitions) {
    assert(statuses.has(transition.to), `${from} targets unknown status ${transition.to}`);
    assert(!targets.has(transition.to), `${from} has duplicate target ${transition.to}`);
    assert(Array.isArray(transition.actors) && transition.actors.length > 0, `${from} -> ${transition.to} has no actor`);
    targets.add(transition.to);
  }
}

assert(
  contract.ORDER_TRANSITIONS.CANCELLED.some(
    (transition) => transition.to === 'REFUNDED' && transition.guard === 'refundApproved',
  ),
  'A cancelled paid order must be able to record its approved refund',
);
console.log(`Contract check passed: ${statuses.size} order statuses and transition targets are consistent.`);
