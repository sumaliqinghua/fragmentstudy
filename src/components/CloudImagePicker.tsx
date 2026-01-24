/**
 * 云端图片选择器
 * 从又拍云存储浏览和选择图片
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Cloud, RefreshCw, Search, FolderOpen, Image as ImageIcon, ChevronLeft, AlertCircle } from 'lucide-react';

interface CloudImagePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  title?: string;
}

interface CloudImage {
  name: string;
  url: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: number;
}

// 又拍云 CDN 配置
const UPYUN_CONFIG = {
  cdnDomain: 'image-15775.test.upcdn.net',
  basePath: '/fragment/img',
  // REST API 配置（用于获取目录列表）
  apiDomain: 'v0.api.upyun.com',
  bucket: 'image-15775',
};

// MD5 实现（用于签名）
function md5(str: string): string {
  function md5cycle(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }
  
  function add32(a: number, b: number) {
    return (a + b) & 0xFFFFFFFF;
  }
  
  function md5blk(s: string) {
    const md5blks: number[] = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) +
                        (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  
  function rhex(n: number) {
    const hex_chr = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += hex_chr.charAt((n >> (j * 8 + 4)) & 0x0F) +
           hex_chr.charAt((n >> (j * 8)) & 0x0F);
    }
    return s;
  }
  
  function hex(x: number[]) {
    return x.map(rhex).join('');
  }
  
  let n = str.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];
  let i: number;
  
  for (i = 64; i <= n; i += 64) {
    md5cycle(state, md5blk(str.substring(i - 64, i)));
  }
  
  str = str.substring(i - 64);
  const tail = new Array(16).fill(0);
  
  for (i = 0; i < str.length; i++) {
    tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3);
  }
  
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  
  if (i > 55) {
    md5cycle(state, tail);
    tail.fill(0);
  }
  
  tail[14] = n * 8;
  md5cycle(state, tail);
  
  return hex(state);
}

// 又拍云凭证存储
const UPYUN_CREDENTIALS_KEY = 'upyun_credentials';

interface UpyunCredentials {
  operator: string;
  password: string;
}

function getStoredCredentials(): UpyunCredentials | null {
  try {
    const stored = localStorage.getItem(UPYUN_CREDENTIALS_KEY);
    if (stored) {
      return JSON.parse(stored) as UpyunCredentials;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveCredentials(credentials: UpyunCredentials): void {
  localStorage.setItem(UPYUN_CREDENTIALS_KEY, JSON.stringify(credentials));
}

// 生成又拍云签名
function generateSignature(
  method: string,
  uri: string,
  date: string,
  contentLength: number,
  password: string
): string {
  const passwordMd5 = md5(password);
  const signStr = `${method}&${uri}&${date}&${contentLength}&${passwordMd5}`;
  return md5(signStr);
}

// 获取目录文件列表
async function fetchDirectoryList(
  path: string,
  credentials: UpyunCredentials
): Promise<CloudImage[]> {
  const uri = `/${UPYUN_CONFIG.bucket}${path}`;
  const date = new Date().toUTCString();
  const signature = generateSignature('GET', uri, date, 0, credentials.password);
  
  const url = `https://${UPYUN_CONFIG.apiDomain}${uri}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `UpYun ${credentials.operator}:${signature}`,
      'Date': date,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`获取目录列表失败: ${response.status}`);
  }
  
  const data = await response.json() as { files: Array<{ name: string; type: string; length: number; last_modified: number }>; iter: string };
  
  return data.files.map((file) => ({
    name: file.name,
    url: `https://${UPYUN_CONFIG.cdnDomain}${path}/${file.name}`,
    type: file.type === 'folder' ? 'folder' : 'file',
    size: file.length,
    lastModified: file.last_modified,
  }));
}

// 图片文件扩展名
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export function CloudImagePicker({ isOpen, onClose, onSelect, title = '云端图片库' }: CloudImagePickerProps) {
  const [images, setImages] = useState<CloudImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(UPYUN_CONFIG.basePath);
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 凭证状态
  const [credentials, setCredentials] = useState<UpyunCredentials | null>(getStoredCredentials);
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [tempOperator, setTempOperator] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  
  // 手动输入 URL
  const [manualUrl, setManualUrl] = useState('');
  const [inputMode, setInputMode] = useState<'browse' | 'manual'>('browse');
  
  const loadImages = useCallback(async () => {
    if (!credentials) {
      setShowCredentialsForm(true);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const list = await fetchDirectoryList(currentPath, credentials);
      // 过滤出图片文件和文件夹
      const filtered = list.filter(item => item.type === 'folder' || isImageFile(item.name));
      // 文件夹排前面
      filtered.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      setImages(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      // 如果是认证失败，清除凭证
      if (err instanceof Error && err.message.includes('401')) {
        setCredentials(null);
        localStorage.removeItem(UPYUN_CREDENTIALS_KEY);
        setShowCredentialsForm(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentPath, credentials]);
  
  useEffect(() => {
    if (isOpen && credentials && inputMode === 'browse') {
      loadImages();
    }
  }, [isOpen, credentials, loadImages, inputMode]);
  
  const handleFolderClick = (folder: CloudImage) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(`${currentPath}/${folder.name}`);
    setSelectedImage(null);
  };
  
  const handleBackClick = () => {
    if (pathHistory.length > 0) {
      const prevPath = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      setCurrentPath(prevPath);
      setSelectedImage(null);
    }
  };
  
  const handleImageClick = (image: CloudImage) => {
    setSelectedImage(image.url);
    setPreviewImage(image.url);
  };
  
  const handleConfirm = () => {
    const imageUrl = inputMode === 'manual' ? manualUrl : selectedImage;
    if (imageUrl) {
      onSelect(imageUrl);
      onClose();
    }
  };
  
  const handleCredentialsSubmit = () => {
    if (!tempOperator.trim() || !tempPassword.trim()) {
      setError('请填写完整的凭证信息');
      return;
    }
    
    const newCredentials = {
      operator: tempOperator.trim(),
      password: tempPassword.trim(),
    };
    
    saveCredentials(newCredentials);
    setCredentials(newCredentials);
    setShowCredentialsForm(false);
    setTempOperator('');
    setTempPassword('');
  };
  
  // 过滤搜索结果
  const filteredImages = searchQuery
    ? images.filter(img => img.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : images;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col" onClick={onClose}>
      <div 
        className="flex-1 flex flex-col max-w-4xl mx-auto w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-teal-400" />
            <h2 className="text-white font-medium">{title}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* 模式切换 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
          <button
            onClick={() => setInputMode('browse')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              inputMode === 'browse' 
                ? 'bg-teal-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            浏览图片库
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              inputMode === 'manual' 
                ? 'bg-teal-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            手动输入URL
          </button>
        </div>
        
        {inputMode === 'manual' ? (
          /* 手动输入模式 */
          <div className="flex-1 p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">图片URL</label>
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder={`例如: https://${UPYUN_CONFIG.cdnDomain}/fragment/img/example.png`}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            
            {manualUrl && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-400 mb-2">预览</p>
                <div className="w-48 h-64 bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  <img
                    src={manualUrl}
                    alt="预览"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '';
                      (e.target as HTMLImageElement).alt = '加载失败';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : showCredentialsForm ? (
          /* 凭证输入表单 */
          <div className="flex-1 p-4 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-4 p-6 bg-gray-800/60 rounded-2xl border border-gray-700">
              <div className="text-center mb-4">
                <Cloud className="w-12 h-12 text-teal-400 mx-auto mb-2" />
                <h3 className="text-white font-medium">又拍云认证</h3>
                <p className="text-xs text-gray-400 mt-1">请输入操作员信息以访问云端图片库</p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">操作员名称</label>
                <input
                  type="text"
                  value={tempOperator}
                  onChange={(e) => setTempOperator(e.target.value)}
                  placeholder="输入操作员名称"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">操作员密码</label>
                <input
                  type="password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="输入操作员密码"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-2 bg-red-900/30 text-red-400 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
              
              <button
                onClick={handleCredentialsSubmit}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
              >
                连接
              </button>
              
              <p className="text-xs text-gray-500 text-center">
                凭证仅保存在本地浏览器
              </p>
            </div>
          </div>
        ) : (
          /* 浏览模式 */
          <>
            {/* 工具栏 */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
              <button
                onClick={handleBackClick}
                disabled={pathHistory.length === 0}
                className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm text-gray-400">
                <FolderOpen className="w-4 h-4" />
                <span className="truncate">{currentPath}</span>
              </div>
              
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索..."
                  className="pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:border-teal-500 focus:outline-none w-40"
                />
              </div>
              
              <button
                onClick={loadImages}
                disabled={isLoading}
                className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {/* 图片网格 */}
            <div className="flex-1 overflow-y-auto p-4">
              {error && (
                <div className="flex items-center justify-center gap-2 p-4 bg-red-900/30 text-red-400 rounded-lg mb-4">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
              
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p>暂无图片</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filteredImages.map((item) => (
                    <div
                      key={item.name}
                      onClick={() => item.type === 'folder' ? handleFolderClick(item) : handleImageClick(item)}
                      className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedImage === item.url 
                          ? 'border-teal-500 ring-2 ring-teal-500/50' 
                          : 'border-transparent hover:border-gray-600'
                      }`}
                    >
                      {item.type === 'folder' ? (
                        <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center">
                          <FolderOpen className="w-10 h-10 text-yellow-500 mb-1" />
                          <span className="text-xs text-gray-400 px-2 truncate w-full text-center">
                            {item.name}
                          </span>
                        </div>
                      ) : (
                        <>
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover bg-gray-800"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white truncate block">
                              {item.name}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <div className="text-sm text-gray-500">
            {inputMode === 'browse' && selectedImage && '已选择 1 张图片'}
            {inputMode === 'manual' && manualUrl && '已输入URL'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={inputMode === 'browse' ? !selectedImage : !manualUrl}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              确认选择
            </button>
          </div>
        </div>
      </div>
      
      {/* 大图预览 */}
      {previewImage && inputMode === 'browse' && (
        <div 
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-8"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="预览"
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

export default CloudImagePicker;
