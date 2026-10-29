import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS } from '../config/gameData';
import type { Battlefield } from '../core/Battlefield';

export function drawBattleMap(ctx: CanvasRenderingContext2D, field?: Battlefield | null): void {
  const layout = field?.layout ?? MAP_LAYOUT;
  const waypoints = field?.waypoints ?? PATH_WAYPOINTS;
  ctx.save();
  ctx.lineWidth = 1;
  for (let y = 0; y < layout.length; y++) {
    for (let x = 0; x < layout[y].length; x++) {
      const type = layout[y][x];
      const px = x * CONFIG.TILE_SIZE;
      const py = y * CONFIG.TILE_SIZE;
      switch (type) {
        case 0: ctx.fillStyle = '#686653'; break;
        case 1: ctx.fillStyle = '#aaa58d'; break;
        case 2: ctx.fillStyle = '#474b43'; break;
        case 3: ctx.fillStyle = '#754f46'; break;
        case 4: ctx.fillStyle = '#467568'; break;
      }
      ctx.fillRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
      ctx.strokeStyle = '#303b33';
      ctx.strokeRect(px, py, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
      if (type === 3 || type === 4) {
        ctx.fillStyle = type === 3 ? '#f2b19b' : '#b4eee0';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(type === 3 ? 'IN' : 'OUT', px + (type === 3 ? 22 : 15), py + 38);
      }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const route of field?.routes ?? [waypoints]) {
    route.forEach((point, index) => {
      const x = point.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const y = point.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
  }
  ctx.stroke();
  ctx.restore();
}
