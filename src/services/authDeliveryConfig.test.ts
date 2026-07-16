import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmailDeliveryEnabled } from './authDeliveryConfig.ts';

test('email delivery is disabled unless explicitly enabled', () => {
  assert.equal(resolveEmailDeliveryEnabled(undefined), false);
  assert.equal(resolveEmailDeliveryEnabled('false'), false);
  assert.equal(resolveEmailDeliveryEnabled('true'), true);
});
