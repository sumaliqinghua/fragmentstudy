/**
 * 云端图片选择器
 * 从 CDN 配置文件读取角色立绘列表
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Cloud, RefreshCw, Image as ImageIcon, Check, Users } from 'lucide-react';

interface CloudImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  title?: string;
  /** 当前选择立绘的角色名 */
  characterName?: string;
}

// 又拍云 CDN 配置
const UPYUN_CONFIG = {
  cdnDomain: 'image-15775.test.upcdn.net',
  basePath: '/fragment/img',
  protocol: 'http',
  configFile: 'config.json',
};

// 配置文件类型
interface CharacterConfig {
  count: number;
  images: string[];
}

interface ImageConfig {
  characters: Record<string, CharacterConfig>;
  updatedAt: string;
}

// 缓存配置
let cachedConfig: ImageConfig | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 构建图片 URL
function buildImageUrl(characterName: string, fileName: string): string {
  return `${UPYUN_CONFIG.protocol}://${UPYUN_CONFIG.cdnDomain}${UPYUN_CONFIG.basePath}/${characterName}/${fileName}`;
}

// 获取配置文件 URL
function getConfigUrl(): string {
  return `${UPYUN_CONFIG.protocol}://${UPYUN_CONFIG.cdnDomain}${UPYUN_CONFIG.basePath}/${UPYUN_CONFIG.configFile}`;
}

// 加载配置文件
async function loadConfig(forceRefresh = false): Promise<ImageConfig | null> {
  const now = Date.now();
  
  // 使用缓存
  if (!forceRefresh && cachedConfig && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedConfig;
  }
  
  try {
    const url = `${getConfigUrl()}?t=${now}`; // 添加时间戳避免缓存
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`配置文件加载失败: ${response.status}`);
    }
    
    const config = await response.json() as ImageConfig;
    cachedConfig = config;
    cacheTimestamp = now;
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    return null;
  }
}

export function CloudImagePicker({ 
  isOpen, 
  onClose, 
  onSelect, 
  title = '云端图片库',
  characterName 
}: CloudImagePickerProps) {
  const [config, setConfig] = useState<ImageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'character' | 'all'>('character');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  
  // 加载配置
  const loadConfigData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await loadConfig(forceRefresh);
      if (data) {
        setConfig(data);
        // 如果指定了角色名，自动选中
        if (characterName && data.characters[characterName]) {
          setSelectedCharacter(characterName);
          setViewMode('character');
        } else if (characterName) {
          // 角色名不在配置中，显示所有
          setViewMode('all');
        }
      } else {
        setError('无法加载配置文件');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [characterName]);
  
  // 打开时加载
  useEffect(() => {
    if (isOpen) {
      loadConfigData();
      setSelectedUrl(null);
      setPreviewUrl(null);
      setLoadedImages(new Set());
      setFailedImages(new Set());
      if (characterName) {
        setSelectedCharacter(characterName);
        setViewMode('character');
      }
    }
  }, [isOpen, loadConfigData, characterName]);
  
  // 获取当前显示的图片列表
  const getDisplayImages = useCallback((): { url: string; name: string; character: string }[] => {
    if (!config) return [];
    
    const images: { url: string; name: string; character: string }[] = [];
    
    if (viewMode === 'character' && selectedCharacter) {
      const charConfig = config.characters[selectedCharacter];
      if (charConfig) {
        charConfig.images.forEach(fileName => {
          images.push({
            url: buildImageUrl(selectedCharacter, fileName),
            name: fileName,
            character: selectedCharacter,
          });
        });
      }
    } else {
      // 显示所有角色的图片
      Object.entries(config.characters).forEach(([charName, charConfig]) => {
        charConfig.images.forEach(fileName => {
          images.push({
            url: buildImageUrl(charName, fileName),
            name: fileName,
            character: charName,
          });
        });
      });
    }
    
    return images;
  }, [config, viewMode, selectedCharacter]);
  
  const displayImages = getDisplayImages();
  const characterList = config ? Object.keys(config.characters).sort() : [];
  
  // 图片加载回调
  const handleImageLoad = (url: string) => {
    setLoadedImages(prev => new Set(prev).add(url));
  };
  
  const handleImageError = (url: string) => {
    setFailedImages(prev => new Set(prev).add(url));
  };
  
  // 选择图片
  const handleSelectImage = (url: string) => {
    setSelectedUrl(url);
    setPreviewUrl(url);
  };
  
  // 确认选择
  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onClose();
    }
  };
  
  // 关闭
  const handleClose = () => {
    setSelectedUrl(null);
    setPreviewUrl(null);
    onClose();
  };
  
  // 提取图片序号
  const getImageIndex = (fileName: string): string => {
    const match = fileName.match(/_(\d+)\./);
    return match ? match[1] : '';
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col" onClick={handleClose}>
      <div 
        className="flex-1 flex flex-col max-w-5xl mx-auto w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-white font-medium">{title}</h2>
              {config && (
                <p className="text-xs text-gray-400 mt-0.5">
                  共 {characterList.length} 个角色，更新于 {new Date(config.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadConfigData(true)}
              disabled={isLoading}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="刷新配置"
            >
              <RefreshCw className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={handleClose} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* 角色选择栏 */}
        {config && characterList.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 overflow-x-auto">
            <button
              onClick={() => {
                setViewMode('all');
                setSelectedCharacter(null);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Users className="w-4 h-4" />
              全部
            </button>
            <div className="w-px h-6 bg-gray-700" />
            {characterList.map(name => (
              <button
                key={name}
                onClick={() => {
                  setSelectedCharacter(name);
                  setViewMode('character');
                }}
                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  viewMode === 'character' && selectedCharacter === name
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {name}
                <span className="ml-1 text-xs opacity-70">
                  ({config.characters[name].count})
                </span>
              </button>
            ))}
          </div>
        )}
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <RefreshCw className="w-10 h-10 text-teal-400 animate-spin mb-3" />
              <p className="text-gray-400">正在加载配置...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ImageIcon className="w-16 h-16 mb-3 opacity-50" />
              <p className="text-lg text-red-400">{error}</p>
              <p className="text-sm mt-2 text-gray-600">
                请确保配置文件存在: {getConfigUrl()}
              </p>
              <button
                onClick={() => loadConfigData(true)}
                className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
              >
                重试
              </button>
            </div>
          ) : displayImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ImageIcon className="w-16 h-16 mb-3 opacity-50" />
              <p className="text-lg">暂无图片</p>
              {characterName && (
                <p className="text-sm mt-2 text-gray-600">
                  角色 "{characterName}" 不在配置文件中
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayImages.map(({ url, name, character }) => {
                const isSelected = selectedUrl === url;
                const isLoaded = loadedImages.has(url);
                const isFailed = failedImages.has(url);
                const index = getImageIndex(name);
                
                return (
                  <div
                    key={url}
                    onClick={() => !isFailed && handleSelectImage(url)}
                    className={`group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      isSelected 
                        ? 'border-teal-500 ring-2 ring-teal-500/50 scale-[1.02]' 
                        : 'border-transparent hover:border-gray-600'
                    } ${isFailed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* 加载占位 */}
                    {!isLoaded && !isFailed && (
                      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 text-gray-600 animate-spin" />
                      </div>
                    )}
                    
                    {/* 图片 */}
                    <img
                      src={url}
                      alt={`${character} ${index}`}
                      className={`w-full h-full object-cover bg-gray-800 transition-opacity ${
                        isLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      loading="lazy"
                      onLoad={() => handleImageLoad(url)}
                      onError={() => handleImageError(url)}
                    />
                    
                    {/* 信息标签 */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {viewMode === 'all' && (
                        <span className="px-2 py-0.5 bg-black/70 rounded-md text-xs text-white truncate max-w-[80px]">
                          {character}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-black/70 rounded-md text-xs text-teal-300 font-medium">
                        #{index}
                      </span>
                    </div>
                    
                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    
                    {/* 失败标记 */}
                    {isFailed && (
                      <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                        <p className="text-xs text-gray-500">加载失败</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            {displayImages.length > 0 && `显示 ${displayImages.length} 张图片`}
            {selectedUrl && ' · 已选择 1 张'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedUrl}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              确认选择
            </button>
          </div>
        </div>
      </div>
      
      {/* 大图预览 */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-white text-sm">
            点击任意位置关闭预览
          </div>
        </div>
      )}
    </div>
  );
}

export default CloudImagePicker;
