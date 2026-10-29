import { CONFIG } from '../config/gameData';
import { Operator, TileType, Vector2 } from '../types';

export interface Battlefield {
  layout: TileType[][];
  waypoints: Vector2[];
  routes?: Vector2[][];
}

export interface DefenseFormation {
  playerId: string;
  operators: Operator[];
}

// 两处原型地图左右镜像后拼接，入口在右，出口在左；接口区域补一条连接通道。
export function buildDefenseField(layout: TileType[][], waypoints: Vector2[], helperCount: number): Battlefield {
  if (helperCount !== 2) return { layout: layout.map(row => row.slice()), waypoints: waypoints.map(point => ({ ...point })) };
  const width = layout[0].length;
  const mirrored = layout.map(row => row.slice().reverse().map(tile => tile === 3 || tile === 4 ? 0 : tile) as TileType[]);
  const combined = mirrored.map(row => [...row, ...row]);
  const left = waypoints.map(point => ({ x: width - 1 - point.x, y: point.y }));
  const right = left.map(point => ({ x: point.x + width, y: point.y }));
  const bridge = [{ x: width, y: right[right.length - 1].y }, { x: width, y: left[0].y }];
  const path: Vector2[] = [];
  for (const point of [...right, ...bridge, ...left]) {
    const previous = path[path.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) path.push(point);
  }
  for (let i = right.length - 1; i < right.length + bridge.length; i++) {
    const a = path[i], b = path[i + 1];
    if (!a || !b) continue;
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    let x = a.x, y = a.y;
    while (x !== b.x || y !== b.y) {
      x += dx; y += dy;
      combined[y][x] = 0;
    }
  }
  const start = path[0], end = path[path.length - 1];
  combined[start.y][start.x] = 3;
  combined[end.y][end.x] = 4;
  return { layout: combined, waypoints: path };
}

function copyFormationOperator(original: Operator, playerId: string): Operator {
    const op = structuredClone(original);
    op.id = `${playerId}:${op.id}`;
    op.blockingEnemyIds = [];
    op.cooldown = 0;
    op.skillAutoCooldown = 3;
    if (op.skillActive) {
      op.skillActive = false;
      op.skillDuration = 0;
      op.currentSp = 0;
    }
    op.effects = op.effects.filter(effect => effect.duration < 0);
    return op;
}

function mirrorOperator(op: Operator, offset: number): void {
  op.gridPos.x = CONFIG.MAP_WIDTH - 1 - op.gridPos.x + offset;
  op.pos.x = op.gridPos.x * CONFIG.TILE_SIZE;
  if (op.direction === 'left') op.direction = 'right';
  else if (op.direction === 'right') op.direction = 'left';
}

export function combineDefenseFormations(formations: DefenseFormation[]): Operator[] {
  const paired = formations.length === 2;
  return formations.flatMap((formation, index) => formation.operators.map(original => {
    const op = copyFormationOperator(original, formation.playerId);
    if (paired) {
      mirrorOperator(op, index === 0 ? CONFIG.MAP_WIDTH : 0);
    }
    return op;
  }));
}

export function buildAssaultField(layout: TileType[][], waypoints: Vector2[], playerCount: number): { field: Battlefield; routes: Vector2[][] } {
  const left = waypoints.map(point => ({ ...point }));
  if (playerCount !== 2) return { field: { layout: layout.map(row => row.slice()), waypoints: left }, routes: [left] };
  const width = layout[0].length;
  const right = waypoints.map(point => ({ x: width * 2 - 1 - point.x, y: point.y }));
  const routes = [left, right];
  return { field: { layout: layout.map(row => [...row, ...row.slice().reverse()]), waypoints: left, routes }, routes };
}

export function combineAssaultFormations(formations: DefenseFormation[]): Operator[] {
  return formations.flatMap((formation, index) => formation.operators.map(original => {
    const op = copyFormationOperator(original, formation.playerId);
    if (index === 1) mirrorOperator(op, CONFIG.MAP_WIDTH);
    return op;
  }));
}
