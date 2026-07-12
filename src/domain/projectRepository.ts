import type { Fragment, GenerationJob, Material, MaterialSourceType, Project, ProjectMaterial } from './project.ts';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  entries<T>(prefix: string): Promise<readonly (readonly [string, T])[]>;
}

export interface ProjectRepository {
  createProject(input: { title: string }): Promise<Project>;
  listProjects(): Promise<readonly Project[]>;
  deleteProject(projectId: string): Promise<void>;
  addMaterial(input: { projectId: string; title: string; sourceType: MaterialSourceType; content: string; sourceUrl?: string }): Promise<ProjectMaterial>;
  listProjectMaterials(projectId: string): Promise<readonly ProjectMaterial[]>;
  saveFragment(input: Omit<Fragment, 'id'>): Promise<Fragment>;
  listFragments(projectId: string, projectMaterialId: string): Promise<readonly Fragment[]>;
  saveGenerationJob(input: Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<GenerationJob>;
  listGenerationJobs(projectId: string): Promise<readonly GenerationJob[]>;
}

const keys = { project: 'project:', material: 'material:', link: 'project-material:', fragment: 'fragment:', job: 'generation-job:' } as const;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function createGuestProjectRepository(store: KeyValueStore): ProjectRepository {
  return {
    async createProject(input) {
      const project = Object.freeze({ id: id(), title: input.title, createdAt: now() });
      await store.set(keys.project + project.id, project);
      return project;
    },
    async listProjects() { return (await store.entries<Project>(keys.project)).map(([, value]) => value); },
    async deleteProject(projectId) {
      const links = await this.listProjectMaterials(projectId);
      for (const link of links) {
        for (const [key] of await store.entries<Fragment>(keys.fragment)) {
          const fragment = await store.get<Fragment>(key);
          if (fragment?.projectMaterialId === link.id) await store.delete(key);
        }
        await store.delete(keys.link + link.id);
        await store.delete(keys.material + link.materialId);
      }
      for (const [key, job] of await store.entries<GenerationJob>(keys.job)) if (job.projectId === projectId) await store.delete(key);
      await store.delete(keys.project + projectId);
    },
    async addMaterial(input) {
      if (!await store.get<Project>(keys.project + input.projectId)) throw new Error('Project not found');
      const createdAt = now();
      const material: Material = { id: id(), title: input.title, sourceType: input.sourceType, content: input.content, sourceUrl: input.sourceUrl, createdAt };
      const link: ProjectMaterial = { id: id(), projectId: input.projectId, materialId: material.id, createdAt };
      await store.set(keys.material + material.id, material);
      await store.set(keys.link + link.id, link);
      return Object.freeze(link);
    },
    async listProjectMaterials(projectId) { return (await store.entries<ProjectMaterial>(keys.link)).map(([, value]) => value).filter(value => value.projectId === projectId); },
    async saveFragment(input) {
      if (!await store.get<ProjectMaterial>(keys.link + input.projectMaterialId)) throw new Error('Project material not found');
      const fragment = Object.freeze({ id: id(), ...input });
      await store.set(keys.fragment + fragment.id, fragment);
      return fragment;
    },
    async listFragments(projectId, projectMaterialId) {
      const link = await store.get<ProjectMaterial>(keys.link + projectMaterialId);
      if (link?.projectId !== projectId) return [];
      return (await store.entries<Fragment>(keys.fragment)).map(([, value]) => value).filter(value => value.projectMaterialId === projectMaterialId).sort((a, b) => a.order - b.order);
    },
    async saveGenerationJob(input) {
      if (!await store.get<Project>(keys.project + input.projectId)) throw new Error('Project not found');
      const existing = (await this.listGenerationJobs(input.projectId)).find(job => job.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
      const timestamp = now();
      const job = Object.freeze({ id: id(), ...input, createdAt: timestamp, updatedAt: timestamp });
      await store.set(keys.job + job.id, job);
      return job;
    },
    async listGenerationJobs(projectId) { return (await store.entries<GenerationJob>(keys.job)).map(([, value]) => value).filter(value => value.projectId === projectId); },
  };
}

export function createMemoryKeyValueStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return { async get<T>(key: string) { return values.get(key) as T | undefined; }, async set<T>(key: string, value: T) { values.set(key, value); }, async delete(key: string) { values.delete(key); }, async entries<T>(prefix: string) { return [...values.entries()].filter(([key]) => key.startsWith(prefix)) as [string, T][]; } };
}

export function createIndexedDbKeyValueStore(databaseName = 'fragment-learning-v2'): KeyValueStore {
  const request = indexedDB.open(databaseName, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('records');
  const database = new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const transaction = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const tx = (await database).transaction('records', mode);
    return new Promise<T>((resolve, reject) => {
      const operation = run(tx.objectStore('records'));
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
  };
  return { get: key => transaction('readonly', store => store.get(key)), set: async (key, value) => { await transaction('readwrite', store => store.put(value, key)); }, delete: async key => { await transaction('readwrite', store => store.delete(key)); }, entries: async <T>(prefix: string): Promise<readonly (readonly [string, T])[]> => { const db = await database; return new Promise<readonly (readonly [string, T])[]>((resolve, reject) => { const output: Array<readonly [string, T]> = []; const cursor = db.transaction('records').objectStore('records').openCursor(); cursor.onsuccess = () => { const item = cursor.result; if (!item) return resolve(output); if (String(item.key).startsWith(prefix)) output.push([String(item.key), item.value as T]); item.continue(); }; cursor.onerror = () => reject(cursor.error); }); } };
}
