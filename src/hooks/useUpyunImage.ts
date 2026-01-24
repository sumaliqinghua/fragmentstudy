/**
 * 又拍云图片加载 Hook
 * 提供图片加载状态管理和缓存功能
 */

import { useState, useEffect, useCallback } from 'react';
import { upyunStorage, CacheOptions } from '../services/upyunStorage';

interface UseUpyunImageOptions extends CacheOptions {
  autoLoad?: boolean;  // 是否自动加载，默认 true
}

interface UseUpyunImageResult {
  src: string | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * 加载单张又拍云图片
 */
export function useUpyunImage(
  path: string | null,
  options: UseUpyunImageOptions = {}
): UseUpyunImageResult {
  const { autoLoad = true, ...cacheOptions } = options;
  
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const load = useCallback(async () => {
    if (!path) {
      setSrc(null);
      return;
    }
    
    if (!upyunStorage.isInitialized()) {
      setError(new Error('UpyunStorage 未初始化，请先调用 upyunStorage.init()'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const dataUrl = await upyunStorage.loadImage(path, cacheOptions);
      setSrc(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setSrc(null);
    } finally {
      setIsLoading(false);
    }
  }, [path, cacheOptions.maxAge, cacheOptions.forceRefresh]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  const reload = useCallback(async () => {
    await load();
  }, [load]);
  
  return { src, isLoading, error, reload };
}

interface UseUpyunImagesResult {
  images: Map<string, string>;
  isLoading: boolean;
  errors: Map<string, Error>;
  loadedCount: number;
  totalCount: number;
  reload: () => Promise<void>;
}

/**
 * 批量加载又拍云图片
 */
export function useUpyunImages(
  paths: string[],
  options: UseUpyunImageOptions & { concurrency?: number } = {}
): UseUpyunImagesResult {
  const { autoLoad = true, concurrency = 3, ...cacheOptions } = options;
  
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  
  const load = useCallback(async () => {
    if (paths.length === 0) {
      setImages(new Map());
      setErrors(new Map());
      return;
    }
    
    if (!upyunStorage.isInitialized()) {
      const initError = new Error('UpyunStorage 未初始化');
      setErrors(new Map(paths.map(p => [p, initError])));
      return;
    }
    
    setIsLoading(true);
    
    const results = await upyunStorage.loadImages(paths, { concurrency, ...cacheOptions });
    
    const newImages = new Map<string, string>();
    const newErrors = new Map<string, Error>();
    
    results.forEach((value, key) => {
      if (value instanceof Error) {
        newErrors.set(key, value);
      } else {
        newImages.set(key, value);
      }
    });
    
    setImages(newImages);
    setErrors(newErrors);
    setIsLoading(false);
  }, [paths.join(','), concurrency, cacheOptions.maxAge, cacheOptions.forceRefresh]);
  
  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);
  
  return {
    images,
    isLoading,
    errors,
    loadedCount: images.size,
    totalCount: paths.length,
    reload: load,
  };
}

interface UseCacheStatsResult {
  count: number;
  totalSize: number;
  formattedSize: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
  cleanExpired: (maxAge?: number) => Promise<number>;
  clearAll: () => Promise<void>;
}

/**
 * 缓存统计和管理 Hook
 */
export function useCacheStats(): UseCacheStatsResult {
  const [stats, setStats] = useState({ count: 0, totalSize: 0 });
  const [isLoading, setIsLoading] = useState(false);
  
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const newStats = await upyunStorage.getCacheStats();
      setStats(newStats);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const cleanExpired = useCallback(async (maxAge?: number) => {
    const cleaned = await upyunStorage.cleanExpiredCache(maxAge);
    await refresh();
    return cleaned;
  }, [refresh]);
  
  const clearAll = useCallback(async () => {
    await upyunStorage.clearAllCache();
    await refresh();
  }, [refresh]);
  
  useEffect(() => {
    refresh();
  }, [refresh]);
  
  return {
    count: stats.count,
    totalSize: stats.totalSize,
    formattedSize: formatSize(stats.totalSize),
    isLoading,
    refresh,
    cleanExpired,
    clearAll,
  };
}
