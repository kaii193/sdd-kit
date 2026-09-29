import { cartTotal } from '../cart/index.js';

export function priceOrder(items) {
  return { subtotal: cartTotal(items), total: cartTotal(items) };
}
