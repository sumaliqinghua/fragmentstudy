import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractUserBearerToken,
  FunctionAuthError,
} from './functionAuthSecurity.ts';

test('content extraction requires a bearer user token', () => {
  for (const value of [null, '', 'Basic abc', 'Bearer   ']) {
    assert.throws(
      () => extractUserBearerToken(value),
      (error: unknown) =>
        error instanceof FunctionAuthError
        && error.status === 401
        && /登录/.test(error.message),
    );
  }

  assert.equal(extractUserBearerToken('Bearer user-token'), 'user-token');
});
