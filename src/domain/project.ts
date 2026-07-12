export interface Project { readonly id: string; readonly title: string; readonly createdAt: string; }
export type MaterialSourceType = 'text' | 'url' | 'file';
export interface Material { readonly id: string; readonly title: string; readonly sourceType: MaterialSourceType; readonly content: string; readonly sourceUrl?: string; readonly createdAt: string; }
export interface ProjectMaterial { readonly id: string; readonly projectId: string; readonly materialId: string; readonly createdAt: string; }
export interface Section { readonly id: string; readonly projectMaterialId: string; readonly title: string; readonly order: number; }
export interface Fragment { readonly id: string; readonly projectMaterialId: string; readonly sectionId?: string; readonly order: number; readonly content: string; readonly sourceText: string; readonly sourceStart: number; readonly sourceEnd: number; }
export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export interface GenerationJob { readonly id: string; readonly projectId: string; readonly projectMaterialId?: string; readonly status: GenerationJobStatus; readonly version: number; readonly idempotencyKey: string; readonly error?: string; readonly attempts: number; readonly createdAt: string; readonly updatedAt: string; }
