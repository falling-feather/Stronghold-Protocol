import { GameEngine } from '../core/GameEngine';
import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, OPERATOR_DB } from '../config/gameData';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.canvas.width = CONFIG.MAP_WIDTH * CONFIG.TILE_SIZE;
    this.canvas.height = CONFIG.MAP_HEIGHT * CONFIG.TILE_SIZE;
  }

  render(engine: GameEngine) {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawMap();
    this.drawPathGuide();
    
    // Draw Overlay for Placement
    if (engine.selectedShopItemId) {
      this.drawPlacementOverlay(engine);
    }

    engine.operators.forEach(op => this.drawOperator(op));
    engine.enemies.forEach(enemy => this.drawEnemy(enemy));
    engine.projectiles.forEach(proj => this.drawProjectile(proj));
  }

  private drawMap() {
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
        const type = MAP_LAYOUT[y][x];
        const posX = x * CONFIG.TILE_SIZE;
        const posY = y * CONFIG.TILE_SIZE;

        switch (type) {
          case 0: this.ctx.fillStyle = '#34495e'; break; // 地面
          case 1: this.ctx.fillStyle = '#95a5a6'; break; // 高台
          case 2: this.ctx.fillStyle = '#2c3e50'; break; // 墙
          case 3: this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)'; break; // 红门
          case 4: this.ctx.fillStyle = 'rgba(52, 152, 219, 0.2)'; break; // 蓝门
        }
        
        this.ctx.fillRect(posX, posY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        this.ctx.strokeStyle = '#222';
        this.ctx.strokeRect(posX, posY, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        
        if(type === 3) {
           this.ctx.fillStyle = '#e74c3c';
           this.ctx.font = 'bold 16px Arial';
           this.ctx.fillText("IN", posX + 22, posY + 38);
        }
        if(type === 4) {
           this.ctx.fillStyle = '#3498db';
           this.ctx.font = 'bold 16px Arial';
           this.ctx.fillText("OUT", posX + 15, posY + 38);
        }
      }
    }
  }

  private drawPathGuide() {
    this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.beginPath();
    PATH_WAYPOINTS.forEach((p, i) => {
      const cx = p.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2;
      const cy = p.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE/2;
      if (i===0) this.ctx.moveTo(cx, cy);
      else this.ctx.lineTo(cx, cy);
    });
    this.ctx.stroke();
  }

  private drawOperator(op: any) {
    this.ctx.fillStyle = op.color;
    const padding = 6;
    const size = CONFIG.TILE_SIZE - padding * 2;
    this.ctx.fillRect(op.pos.x + padding, op.pos.y + padding, size, size);
    
    // 职业/名字
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px Arial';
    this.ctx.fillText(op.name, op.pos.x + 10, op.pos.y + 20);
    
    // 阻挡数显示
    this.ctx.fillStyle = '#ecf0f1';
    this.ctx.font = '10px Arial';
    const blockText = `B:${op.blockingEnemyIds.length}/${op.stats.blockCount}`;
    this.ctx.fillText(blockText, op.pos.x + 10, op.pos.y + size);

    // 冷却条
    const ratio = op.cooldown / op.stats.aspd;
    this.ctx.fillStyle = '#f1c40f';
    this.ctx.fillRect(op.pos.x + padding, op.pos.y + size + 2, size * (1-ratio), 3);
  }

  private drawEnemy(enemy: any) {
    this.ctx.save();
    this.ctx.translate(enemy.pos.x, enemy.pos.y);
    
    this.ctx.fillStyle = enemy.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // 阻挡状态标记
    if(enemy.isBlockedBy) {
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    // 血条
    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(-12, -22, 24, 4);
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.fillRect(-12, -22, 24 * (enemy.stats.hp / enemy.stats.maxHp), 4);

    this.ctx.restore();
  }

  private drawProjectile(proj: any) {
    this.ctx.fillStyle = proj.color;
    this.ctx.beginPath();
    this.ctx.arc(proj.pos.x, proj.pos.y, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPlacementOverlay(engine: GameEngine) {
    const item = engine.shopItems.find(i => i.uid === engine.selectedShopItemId);
    if (!item) return;
    
    const template = OPERATOR_DB[item.templateId as keyof typeof OPERATOR_DB];
    const targetType = template.placement === 'ground' ? 0 : 1;

    this.ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
    
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
        const isCorrectTerrain = MAP_LAYOUT[y][x] === targetType;
        const isOccupied = engine.operators.some(o => o.gridPos.x === x && o.gridPos.y === y);

        if (isCorrectTerrain && !isOccupied) {
           this.ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        }
      }
    }
  }
}