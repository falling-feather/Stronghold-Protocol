// v3.15.0 / GH Pages：联机 ws 默认地址解析
// 优先级：localStorage('sp.mp.url') > 构建时环境变量 VITE_MP_DEFAULT_URL > 同源回退 > 本地默认
// 在仓库 Settings > Variables(Actions) 配置 VITE_MP_DEFAULT_URL，例如 wss://your-host/ws

interface ImportMetaEnvLike {
  VITE_MP_DEFAULT_URL?: string;
}
interface ImportMetaLike {
  env?: ImportMetaEnvLike;
}

const FALLBACK_LOCAL = 'ws://localhost:8787';
const STORAGE_KEY = 'sp.mp.url';

function readEnvUrl(): string {
  try {
    const meta = (import.meta as unknown) as ImportMetaLike;
    const v = meta?.env?.VITE_MP_DEFAULT_URL;
    if (typeof v === 'string' && v.trim()) return v.trim();
  } catch { /* ignore */ }
  return '';
}

function readStoredUrl(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (typeof v === 'string' && v.trim()) return v.trim();
  } catch { /* ignore */ }
  return '';
}

export function getDefaultMpUrl(): string {
  const stored = readStoredUrl();
  if (stored) return stored;
  const envUrl = readEnvUrl();
  if (envUrl) return envUrl;
  // 本地开发或未配置时用本地默认
  if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    return FALLBACK_LOCAL;
  }
  // 部署到静态站点但未配置时，给一个合理占位（同源不可达也无所谓，玩家会改地址栏）
  return FALLBACK_LOCAL;
}

export function setDefaultMpUrl(url: string): void {
  try {
    if (url && url.trim()) localStorage.setItem(STORAGE_KEY, url.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
