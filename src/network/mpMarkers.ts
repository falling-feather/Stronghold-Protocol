// v4.2.0：联机标记点 — guest 在观战画面点击发出，host 在主画面叠加显示
import { mpAdapter } from './mpBridge';

export interface MpMarker {
  x: number;
  y: number;
  from: string;
  label: string;
  expireAt: number; // performance.now() ms
}

const MARKER_TTL_MS = 5000;
const markers: MpMarker[] = [];
let installed = false;

export function getActiveMarkers(): MpMarker[] {
  const now = performance.now();
  while (markers.length > 0 && markers[0].expireAt < now) markers.shift();
  return markers;
}

export function pushLocalMarker(x: number, y: number, from: string, label = ''): void {
  markers.push({ x, y, from, label, expireAt: performance.now() + MARKER_TTL_MS });
}

export function installMarkerListener(): void {
  if (installed) return;
  installed = true;
  mpAdapter.on('marker', (msg) => {
    const m = msg.payload as any;
    if (!m || typeof m.x !== 'number' || typeof m.y !== 'number') return;
    pushLocalMarker(m.x, m.y, m.from || '对端', m.label || '');
  });
}

export function drawMarkers(ctx: CanvasRenderingContext2D): void {
  const now = performance.now();
  const active = getActiveMarkers();
  for (const m of active) {
    const remain = (m.expireAt - now) / MARKER_TTL_MS;
    const alpha = Math.max(0.15, remain);
    const r = 18 + (1 - remain) * 10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${m.from}${m.label ? ' · ' + m.label : ''}`, m.x, m.y - r - 4);
    ctx.restore();
  }
}
