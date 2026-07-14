/**
 * 又拍云图片组件
 * 支持自动加载、缓存、加载状态显示和错误处理
 */

import React, { useState, useCallback } from 'react';
import { useUpyunImage, useCacheStats } from '../hooks/useUpyunImage';
import { CacheOptions } from '../services/upyunStorage';

interface UpyunImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** 又拍云文件路径 */
  path: string;
  /** 缓存选项 */
  cacheOptions?: CacheOptions;
  /** 加载中显示的占位符 */
  placeholder?: React.ReactNode;
  /** 加载失败显示的内容 */
  fallback?: React.ReactNode;
  /** 容器类名 */
  containerClassName?: string;
  /** 是否显示加载进度 */
  showLoading?: boolean;
}

export function UpyunImage({
  path,
  cacheOptions,
  placeholder,
  fallback,
  containerClassName = '',
  showLoading = true,
  className = '',
  alt = '',
  ...imgProps
}: UpyunImageProps) {
  const { src, isLoading, error, reload } = useUpyunImage(path, cacheOptions);
  
  // 默认占位符
  const defaultPlaceholder = (
    <div className="flex items-center justify-center bg-gray-100 rounded animate-pulse">
      <svg
        className="w-8 h-8 text-gray-300"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
  
  // 默认错误显示
  const defaultFallback = (
    <div
      className="flex flex-col items-center justify-center bg-gray-100 rounded text-gray-400 p-4 cursor-pointer"
      onClick={reload}
      title="点击重试"
    >
      <svg
        className="w-8 h-8 mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span className="text-xs">加载失败，点击重试</span>
    </div>
  );
  
  if (isLoading && showLoading) {
    return (
      <div className={containerClassName} style={imgProps.style}>
        {placeholder || defaultPlaceholder}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={containerClassName} style={imgProps.style}>
        {fallback || defaultFallback}
      </div>
    );
  }
  
  if (!src) return null;
  
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      {...imgProps}
    />
  );
}

// ============ 图片画廊组件 ============

interface UpyunGalleryProps {
  /** 图片路径列表 */
  paths: string[];
  /** 缓存选项 */
  cacheOptions?: CacheOptions;
  /** 并发加载数量 */
  concurrency?: number;
  /** 单张图片的类名 */
  imageClassName?: string;
  /** 容器类名 */
  containerClassName?: string;
  /** 图片点击事件 */
  onImageClick?: (path: string, index: number) => void;
}

export function UpyunGallery({
  paths,
  cacheOptions,
  imageClassName = 'w-full h-auto rounded',
  containerClassName = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
  onImageClick,
}: UpyunGalleryProps) {
  return (
    <div className={containerClassName}>
      {paths.map((path, index) => (
        <div
          key={path}
          className="relative overflow-hidden cursor-pointer"
          onClick={() => onImageClick?.(path, index)}
        >
          <UpyunImage
            path={path}
            cacheOptions={cacheOptions}
            className={imageClassName}
            containerClassName="aspect-square"
          />
        </div>
      ))}
    </div>
  );
}

// ============ 缓存管理组件 ============

interface CacheManagerProps {
  className?: string;
}

export function CacheManager({ className = '' }: CacheManagerProps) {
  const {
    count,
    formattedSize,
    isLoading,
    refresh,
    cleanExpired,
    clearAll,
  } = useCacheStats();
  
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  const handleCleanExpired = useCallback(async () => {
    setCleaning(true);
    try {
      const cleaned = await cleanExpired();
      setMessage(`已清理 ${cleaned} 个过期缓存`);
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setCleaning(false);
    }
  }, [cleanExpired]);
  
  const handleClearAll = useCallback(async () => {
    if (!confirm('确定要清空所有图片缓存吗？')) return;
    
    setCleaning(true);
    try {
      await clearAll();
      setMessage('已清空所有缓存');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setCleaning(false);
    }
  }, [clearAll]);
  
  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
      <h3 className="text-lg font-semibold mb-4">图片缓存管理</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">缓存数量：</span>
          <span className="font-medium">{isLoading ? '...' : count} 张</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">占用空间：</span>
          <span className="font-medium">{isLoading ? '...' : formattedSize}</span>
        </div>
      </div>
      
      {message && (
        <div className="mb-4 p-2 bg-green-50 text-green-700 text-sm rounded">
          {message}
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
        >
          刷新
        </button>
        <button
          onClick={handleCleanExpired}
          disabled={cleaning}
          className="flex-1 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors disabled:opacity-50"
        >
          清理过期
        </button>
        <button
          onClick={handleClearAll}
          disabled={cleaning}
          className="flex-1 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors disabled:opacity-50"
        >
          清空全部
        </button>
      </div>
    </div>
  );
}

export default UpyunImage;
