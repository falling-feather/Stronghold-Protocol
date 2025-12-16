import { Vector2 } from '../types';

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