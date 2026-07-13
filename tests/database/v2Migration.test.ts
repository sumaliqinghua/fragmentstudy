import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = new URL('../../supabase/migrations/20260713000000_v2_destructive_baseline.sql', import.meta.url);
const migration = await readFile(migrationPath, 'utf8');

test('migration removes every legacy learning table', () => {
  assert.match(migration, /DROP TABLE IF EXISTS[\s\S]*galgame_messages[\s\S]*articles CASCADE;/);
});

test('persisted sessions retain their immutable learning boundary and cursor', () => {
  const sessions = migration.match(/CREATE TABLE sessions \(([^;]+)\);/)?.[1] ?? '';
  for (const column of ['project_id', 'project_material_id', 'mode', 'current_item_index', 'end_reason']) {
    assert.match(sessions, new RegExp(`\\b${column}\\b`), `sessions must include ${column}`);
  }
});

test('session mode and lifecycle values match the domain contract', () => {
  const sessions = migration.match(/CREATE TABLE sessions \(([^;]+)\);/)?.[1] ?? '';
  assert.match(sessions, /mode text NOT NULL CHECK \(mode IN \('card','dialogue','galgame'\)\)/);
  assert.match(sessions, /status text NOT NULL CHECK \(status IN \('ready','active','paused','ended'\)\)/);
  assert.match(sessions, /end_reason text CHECK \(end_reason IN \('completed','enough_for_today','switch_mode'\)\)/);
});

test('experience items enforce project consistency through their fragments', () => {
  const branch = migration.match(/WHEN 'experience_items' THEN ([^;]+);/)?.[1] ?? '';
  assert.match(branch, /project_materials/);
  assert.match(branch, /pm\.project_id = e\.project_id/);
});

test('exposures enforce that the item belongs to the session experience', () => {
  const branch = migration.match(/WHEN 'exposures' THEN ([^;]+);/)?.[1] ?? '';
  assert.match(branch, /i\.experience_id = s\.experience_id/);
});

test('RLS grants ownership policies only to authenticated users', () => {
  assert.match(migration, /FOR ALL TO authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+\b(?:anon|public)\b/i);
});
