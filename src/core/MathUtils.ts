import { Vector2, Direction } from '../types';

export const getDistance = (a: Vector2, b: Vector2): number => {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
};

export const normalize = (v: Vector2): Vector2 => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  return mag === 0 ? { x: 0, y: 0 } : { x: v.x / mag, y: v.y / mag };
};

export const moveTowards = (current: Vector2, target: Vector2, maxDistance: number): Vector2 => {
  const dist = getDistance(current, target);
  if (dist <= maxDistance) return { ...target };
  
  const dir = normalize({ x: target.x - current.x, y: target.y - current.y });
  return {
    x: current.x + dir.x * maxDistance,
    y: current.y + dir.y * maxDistance
  };
};

export const checkCollision = (circlePos: Vector2, radius: number, rectPos: Vector2, rectSize: number): boolean => {
  // 简化的 圆-矩形 碰撞检测 (用于判断敌人是否碰到了干员的格子)
  const closestX = Math.max(rectPos.x, Math.min(circlePos.x, rectPos.x + rectSize));
  const closestY = Math.max(rectPos.y, Math.min(circlePos.y, rectPos.y + rectSize));
  
  const distanceX = circlePos.x - closestX;
  const distanceY = circlePos.y - closestY;
  
  return (distanceX * distanceX + distanceY * distanceY) < (radius * radius);
};

// 根据朝向和角色类型计算攻击范围内的格子坐标
export function getAttackRangeTiles(
  centerGrid: Vector2,
  direction: Direction,
  placement: 'ground' | 'high_ground',
  rangeValue: number
): Vector2[] {
  const tiles: Vector2[] = [];
  const { x: cx, y: cy } = centerGrid;

  if (placement === 'ground') {
    // 地面角色（近卫、重装）：面前1格
    switch (direction) {
      case 'up': tiles.push({ x: cx, y: cy - 1 }); break;
      case 'down': tiles.push({ x: cx, y: cy + 1 }); break;
      case 'left': tiles.push({ x: cx - 1, y: cy }); break;
      case 'right': tiles.push({ x: cx + 1, y: cy }); break;
    }
  } else {
    // 高台角色（狙击、术师）：根据range值确定范围
    // 速射手：3x4范围（包括自己在内，向前3格，左右各1格）
    // 炮击手/术师：更大的范围
    const rangeWidth = rangeValue >= 4.5 ? 5 : 3; // 宽度（左右对称，所以是3或5）
    const rangeDepth = rangeValue >= 4.5 ? 6 : 4; // 深度（向前延伸）

    switch (direction) {
      case 'up':
        // 向上：从自己开始向上延伸
        for (let dy = 0; dy < rangeDepth; dy++) {
          for (let dx = -Math.floor(rangeWidth / 2); dx <= Math.floor(rangeWidth / 2); dx++) {
            tiles.push({ x: cx + dx, y: cy - dy });
          }
        }
        break;
      case 'down':
        // 向下：从自己开始向下延伸
        for (let dy = 0; dy < rangeDepth; dy++) {
          for (let dx = -Math.floor(rangeWidth / 2); dx <= Math.floor(rangeWidth / 2); dx++) {
            tiles.push({ x: cx + dx, y: cy + dy });
          }
        }
        break;
      case 'left':
        // 向左：从自己开始向左延伸
        for (let dx = 0; dx < rangeDepth; dx++) {
          for (let dy = -Math.floor(rangeWidth / 2); dy <= Math.floor(rangeWidth / 2); dy++) {
            tiles.push({ x: cx - dx, y: cy + dy });
          }
        }
        break;
      case 'right':
        // 向右：从自己开始向右延伸
        for (let dx = 0; dx < rangeDepth; dx++) {
          for (let dy = -Math.floor(rangeWidth / 2); dy <= Math.floor(rangeWidth / 2); dy++) {
            tiles.push({ x: cx + dx, y: cy + dy });
          }
        }
        break;
    }
  }

  return tiles.filter(t => t.x >= 0 && t.x < 10 && t.y >= 0 && t.y < 8); // 过滤地图外的格子
}

// 检查一个世界坐标是否在攻击范围内
export function isInAttackRange(
  opGridPos: Vector2,
  opDirection: Direction,
  opPlacement: 'ground' | 'high_ground',
  opRange: number,
  targetWorldPos: Vector2,
  tileSize: number
): boolean {
  const rangeTiles = getAttackRangeTiles(opGridPos, opDirection, opPlacement, opRange);
  
  // 将目标世界坐标转换为格子坐标
  const targetGridX = Math.floor(targetWorldPos.x / tileSize);
  const targetGridY = Math.floor(targetWorldPos.y / tileSize);
  
  return rangeTiles.some(t => t.x === targetGridX && t.y === targetGridY);
}