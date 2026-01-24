/**
 * 又拍云存储服务
 * 用于从又拍云加载图片并缓存到本地 IndexedDB
 * 
 * 文档参考: https://help.upyun.com/knowledge-base/rest_api/
 */

// ============ 配置接口 ============

interface UpyunConfig {
  bucket: string;           // 服务名称
  operator: string;         // 操作员名称
  password: string;         // 操作员密码
  domain?: string;          // 自定义域名（可选，默认使用 CDN 域名）
}

interface CacheOptions {
  maxAge?: number;          // 缓存过期时间（毫秒），默认 7 天
  forceRefresh?: boolean;   // 强制刷新缓存
}

interface CachedImage {
  data: string;             // Base64 数据
  timestamp: number;        // 缓存时间戳
  contentType: string;      // MIME 类型
  size: number;             // 文件大小
}

// ============ IndexedDB 缓存管理 ============

const DB_NAME = 'upyun_image_cache';
const STORE_NAME = 'images';
const DB_VERSION = 1;
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 天

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getCachedImage(key: string): Promise<CachedImage | null> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function setCachedImage(key: string, value: CachedImage): Promise<void> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put({ key, value });
  });
}

async function removeCachedImage(key: string): Promise<void> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).delete(key);
  });
}

// 清理过期缓存
async function cleanExpiredCache(maxAge: number = DEFAULT_MAX_AGE): Promise<number> {
  const db = await openCacheDb();
  const now = Date.now();
  let cleanedCount = 0;
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const cached = cursor.value.value as CachedImage;
        if (now - cached.timestamp > maxAge) {
          cursor.delete();
          cleanedCount++;
        }
        cursor.continue();
      }
    };
    
    tx.oncomplete = () => resolve(cleanedCount);
    tx.onerror = () => reject(tx.error);
  });
}

// 获取缓存统计信息
async function getCacheStats(): Promise<{ count: number; totalSize: number }> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();
    
    let count = 0;
    let totalSize = 0;
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const cached = cursor.value.value as CachedImage;
        count++;
        totalSize += cached.size;
        cursor.continue();
      }
    };
    
    tx.oncomplete = () => resolve({ count, totalSize });
    tx.onerror = () => reject(tx.error);
  });
}

// 清空所有缓存
async function clearAllCache(): Promise<void> {
  const db = await openCacheDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).clear();
  });
}

// ============ MD5 签名实现 ============

// 简化的 MD5 实现（用于签名）
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
  
  // 处理字符串
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

// ============ 又拍云 API 签名 ============

function generateSignature(
  method: string,
  uri: string,
  date: string,
  contentLength: number,
  passwordMd5: string
): string {
  const signStr = `${method}&${uri}&${date}&${contentLength}&${passwordMd5}`;
  return md5(signStr);
}

function getGMTDate(): string {
  return new Date().toUTCString();
}

// ============ 又拍云服务类 ============

class UpyunStorageService {
  private config: UpyunConfig | null = null;
  private passwordMd5: string = '';
  
  // API 域名选项
  private static readonly API_DOMAINS = {
    auto: 'v0.api.upyun.com',      // 智能选路
    telecom: 'v1.api.upyun.com',   // 电信
    unicom: 'v2.api.upyun.com',    // 联通
    mobile: 'v3.api.upyun.com',    // 移动
  };
  
  /**
   * 初始化又拍云配置
   */
  init(config: UpyunConfig): void {
    this.config = config;
    this.passwordMd5 = md5(config.password);
  }
  
  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.config !== null;
  }
  
  /**
   * 获取文件的 CDN URL（公开访问，无需签名）
   */
  getCdnUrl(path: string): string {
    if (!this.config) throw new Error('UpyunStorage 未初始化');
    
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    if (this.config.domain) {
      return `https://${this.config.domain}${normalizedPath}`;
    }
    
    // 默认使用又拍云 CDN 域名
    return `https://${this.config.bucket}.test.upcdn.net${normalizedPath}`;
  }
  
  /**
   * 获取文件的 REST API URL（需要签名）
   */
  getApiUrl(path: string, domain: keyof typeof UpyunStorageService.API_DOMAINS = 'auto'): string {
    if (!this.config) throw new Error('UpyunStorage 未初始化');
    
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const apiDomain = UpyunStorageService.API_DOMAINS[domain];
    
    return `https://${apiDomain}/${this.config.bucket}${normalizedPath}`;
  }
  
  /**
   * 生成请求头（包含签名）
   */
  private generateHeaders(method: string, path: string, contentLength: number = 0): HeadersInit {
    if (!this.config) throw new Error('UpyunStorage 未初始化');
    
    const date = getGMTDate();
    const uri = `/${this.config.bucket}${path.startsWith('/') ? path : `/${path}`}`;
    const signature = generateSignature(method, uri, date, contentLength, this.passwordMd5);
    
    return {
      'Authorization': `UpYun ${this.config.operator}:${signature}`,
      'Date': date,
    };
  }
  
  /**
   * 从又拍云下载图片
   */
  async downloadImage(path: string): Promise<{ blob: Blob; contentType: string }> {
    if (!this.config) throw new Error('UpyunStorage 未初始化');
    
    const url = this.getApiUrl(path);
    const headers = this.generateHeaders('GET', path, 0);
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    
    return { blob, contentType };
  }
  
  /**
   * 从又拍云加载图片（带缓存）
   */
  async loadImage(path: string, options: CacheOptions = {}): Promise<string> {
    const { maxAge = DEFAULT_MAX_AGE, forceRefresh = false } = options;
    const cacheKey = `upyun:${this.config?.bucket}:${path}`;
    
    // 检查缓存
    if (!forceRefresh) {
      const cached = await getCachedImage(cacheKey);
      if (cached && Date.now() - cached.timestamp < maxAge) {
        return `data:${cached.contentType};base64,${cached.data}`;
      }
    }
    
    // 从又拍云下载
    const { blob, contentType } = await this.downloadImage(path);
    
    // 转换为 Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    // 缓存到 IndexedDB
    const cachedImage: CachedImage = {
      data: base64,
      timestamp: Date.now(),
      contentType,
      size: blob.size,
    };
    await setCachedImage(cacheKey, cachedImage);
    
    return `data:${contentType};base64,${base64}`;
  }
  
  /**
   * 批量加载图片（带并发控制）
   */
  async loadImages(
    paths: string[],
    options: CacheOptions & { concurrency?: number } = {}
  ): Promise<Map<string, string | Error>> {
    const { concurrency = 3, ...cacheOptions } = options;
    const results = new Map<string, string | Error>();
    
    // 分批处理
    for (let i = 0; i < paths.length; i += concurrency) {
      const batch = paths.slice(i, i + concurrency);
      const promises = batch.map(async (path) => {
        try {
          const dataUrl = await this.loadImage(path, cacheOptions);
          results.set(path, dataUrl);
        } catch (error) {
          results.set(path, error instanceof Error ? error : new Error(String(error)));
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }
  
  /**
   * 预加载图片（后台加载，不阻塞）
   */
  preloadImages(paths: string[], options: CacheOptions = {}): void {
    paths.forEach((path) => {
      this.loadImage(path, options).catch((error) => {
        console.warn(`预加载图片失败: ${path}`, error);
      });
    });
  }
  
  /**
   * 获取文件信息
   */
  async getFileInfo(path: string): Promise<{
    type: string;
    size: number;
    date: number;
    md5: string;
  }> {
    if (!this.config) throw new Error('UpyunStorage 未初始化');
    
    const url = this.getApiUrl(path);
    const headers = this.generateHeaders('HEAD', path, 0);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`获取文件信息失败: ${response.status} ${response.statusText}`);
    }
    
    return {
      type: response.headers.get('x-upyun-file-type') || 'file',
      size: parseInt(response.headers.get('x-upyun-file-size') || '0', 10),
      date: parseInt(response.headers.get('x-upyun-file-date') || '0', 10),
      md5: response.headers.get('Content-Md5') || '',
    };
  }
  
  /**
   * 检查文件是否存在
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await this.getFileInfo(path);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * 删除缓存中的图片
   */
  async removeCachedImage(path: string): Promise<void> {
    const cacheKey = `upyun:${this.config?.bucket}:${path}`;
    await removeCachedImage(cacheKey);
  }
  
  /**
   * 清理过期缓存
   */
  cleanExpiredCache = cleanExpiredCache;
  
  /**
   * 获取缓存统计
   */
  getCacheStats = getCacheStats;
  
  /**
   * 清空所有缓存
   */
  clearAllCache = clearAllCache;
}

// ============ 导出单例实例 ============

export const upyunStorage = new UpyunStorageService();

// ============ 导出类型和工具函数 ============

export type { UpyunConfig, CacheOptions, CachedImage };

export {
  UpyunStorageService,
  getCachedImage,
  setCachedImage,
  removeCachedImage,
  cleanExpiredCache,
  getCacheStats,
  clearAllCache,
};
