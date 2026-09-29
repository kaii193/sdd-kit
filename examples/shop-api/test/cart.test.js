import assert from 'node:assert/strict';
import test from 'node:test';
import { cartTotal } from '../src/cart/index.js';

test('sums price times quantity for every item', () => {
  assert.equal(cartTotal([{ price: 200000, quantity: 2 }, { price: 100000, quantity: 1 }]), 500000);
});
