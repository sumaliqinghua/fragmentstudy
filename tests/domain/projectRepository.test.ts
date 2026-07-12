import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestProjectRepository, createMemoryKeyValueStore } from '../../src/domain/projectRepository.ts';

test('repository isolates project data and cascades deletion', async () => {
  const repository = createGuestProjectRepository(createMemoryKeyValueStore());
  const first = await repository.createProject({ title: 'First' });
  const second = await repository.createProject({ title: 'Second' });
  const link = await repository.addMaterial({ projectId: first.id, title: 'Source', sourceType: 'text', content: 'one' });
  await repository.saveFragment({ projectId: first.id, projectMaterialId: link.id, order: 0, content: 'one', sourceText: 'one', sourceStart: 0, sourceEnd: 3 });
  assert.deepEqual(await repository.listProjectMaterials(second.id), []);
  assert.deepEqual(await repository.listFragments(second.id, link.id), []);
  assert.equal((await repository.listProjectMaterials(first.id)).length, 1);
  await repository.deleteProject(first.id);
  assert.deepEqual(await repository.listFragments(first.id, link.id), []);
});

test('repository rejects a fragment written through another project', async () => {
  const repository = createGuestProjectRepository(createMemoryKeyValueStore());
  const first = await repository.createProject({ title: 'First' });
  const second = await repository.createProject({ title: 'Second' });
  const link = await repository.addMaterial({ projectId: first.id, title: 'Source', sourceType: 'text', content: 'one' });

  await assert.rejects(
    repository.saveFragment({ projectId: second.id, projectMaterialId: link.id, order: 0, content: 'one', sourceText: 'one', sourceStart: 0, sourceEnd: 3 }),
    /Project material does not belong to project/,
  );
});

test('generation job storage is idempotent within a project', async () => {
  const repository = createGuestProjectRepository(createMemoryKeyValueStore());
  const project = await repository.createProject({ title: 'First' });
  const input = { projectId: project.id, status: 'queued' as const, version: 1, idempotencyKey: 'same', attempts: 0 };
  const first = await repository.saveGenerationJob(input);
  const duplicate = await repository.saveGenerationJob({ ...input, status: 'running', attempts: 1 });
  assert.equal(first.id, duplicate.id);
  assert.equal((await repository.listGenerationJobs(project.id)).length, 1);
});

test('repository rejects a generation job with a material from another project', async () => {
  const repository = createGuestProjectRepository(createMemoryKeyValueStore());
  const first = await repository.createProject({ title: 'First' });
  const second = await repository.createProject({ title: 'Second' });
  const link = await repository.addMaterial({ projectId: first.id, title: 'Source', sourceType: 'text', content: 'one' });

  await assert.rejects(
    repository.saveGenerationJob({ projectId: second.id, projectMaterialId: link.id, status: 'queued', version: 1, idempotencyKey: 'foreign', attempts: 0 }),
    /Project material does not belong to project/,
  );
});
