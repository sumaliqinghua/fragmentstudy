import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAllGuestData,
  clearGuestData,
  createArticle,
  deleteArticle,
  getArticles,
} from './guestStorage.ts';

test('guest records live in memory and can be discarded as one session', async () => {
  clearGuestData();
  await createArticle('Temporary', 'Session-only text');
  assert.equal((await getArticles()).length, 1);

  clearGuestData();
  assert.deepEqual(await getArticles(), []);
});

test('guest storage runs without browser localStorage', async () => {
  clearGuestData();
  const article = await createArticle('Node test', 'No browser globals');
  assert.equal((await getArticles())[0]?.title, 'Node test');

  await deleteArticle(article.id);
  assert.deepEqual(await getArticles(), []);
});

test('legacy clear entry point discards the in-memory guest session', async () => {
  clearGuestData();
  await createArticle('Temporary', 'Discard me');

  clearAllGuestData();
  assert.deepEqual(await getArticles(), []);
});
