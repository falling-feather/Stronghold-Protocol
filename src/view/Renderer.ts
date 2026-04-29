import { GameEngine } from '../core/GameEngine';
import { CONFIG, MAP_LAYOUT, PATH_WAYPOINTS, OPERATOR_DB } from '../config/gameData';
import { Direction } from '../types';
import { getAttackRangeTiles } from '../core/MathUtils';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.innerWidth <= 768);
    
    if (isMobile) {
      // 移动端：页面已旋转90度，需要根据旋转后的容器大小自适应
      const container = this.canvas.parentElement;
      if (container) {
        // 注意：由于页面旋转了90度，容器的宽高实际上已经互换了
        // 但clientWidth和clientHeight仍然反映旋转后的实际显示尺寸
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // 保持地图比例，适应容器
        const mapAspect = (CONFIG.MAP_WIDTH * CONFIG.TILE_SIZE) / (CONFIG.MAP_HEIGHT * CONFIG.TILE_SIZE);
        const containerAspect = containerWidth / containerHeight;
        
        if (containerAspect > mapAspect) {
          // 容器更宽，以高度为准
          this.canvas.height = containerHeight;
          this.canvas.width = containerHeight * mapAspect;
        } else {
          // 容器更高，以宽度为准
          this.canvas.width = containerWidth;
          this.canvas.height = containerWidth / mapAspect;
        }
      }
    } else {
      // 桌面端：固定尺寸
      this.canvas.width = CONFIG.MAP_WIDTH * CONFIG.TILE_SIZE;
      this.canvas.height = CONFIG.MAP_HEIGHT * CONFIG.TILE_SIZE;
    }
  }

  // 修改：增加 highlightTemplateId 参数，用于绘制部署热力图
  render(engine: GameEngine, highlightTemplateId?: string | null, highlightDirection?: Direction | null) {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawMap();
    this.drawPathGuide();
    
    // 如果有待部署的角色，显示预览和攻击范围
    if (engine.pendingDeployment) {
      this.drawPendingDeployment(engine, highlightDirection);
    }
    // 只有在拖拽或者选中商店/备战区角色时，才显示绿色格子和攻击范围
    else if (highlightTemplateId) {
      this.drawPlacementOverlay(engine, highlightTemplateId);
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
    const padding = 6;
    const size = CONFIG.TILE_SIZE - padding * 2;

    if (op.isRetreated) {
      this.ctx.fillStyle = '#555';
      this.ctx.globalAlpha = 0.5;
    } else {
      this.ctx.fillStyle = op.color;
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.fillRect(op.pos.x + padding, op.pos.y + padding, size, size);
    this.ctx.globalAlpha = 1.0; 

    // 绘制朝向箭头
    if (!op.isRetreated && op.direction) {
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      const centerX = op.pos.x + CONFIG.TILE_SIZE / 2;
      const centerY = op.pos.y + CONFIG.TILE_SIZE / 2;
      const arrowSize = 8;
      
      switch (op.direction) {
        case 'up':
          this.ctx.moveTo(centerX, centerY - arrowSize);
          this.ctx.lineTo(centerX - arrowSize/2, centerY);
          this.ctx.moveTo(centerX, centerY - arrowSize);
          this.ctx.lineTo(centerX + arrowSize/2, centerY);
          break;
        case 'down':
          this.ctx.moveTo(centerX, centerY + arrowSize);
          this.ctx.lineTo(centerX - arrowSize/2, centerY);
          this.ctx.moveTo(centerX, centerY + arrowSize);
          this.ctx.lineTo(centerX + arrowSize/2, centerY);
          break;
        case 'left':
          this.ctx.moveTo(centerX - arrowSize, centerY);
          this.ctx.lineTo(centerX, centerY - arrowSize/2);
          this.ctx.moveTo(centerX - arrowSize, centerY);
          this.ctx.lineTo(centerX, centerY + arrowSize/2);
          break;
        case 'right':
          this.ctx.moveTo(centerX + arrowSize, centerY);
          this.ctx.lineTo(centerX, centerY - arrowSize/2);
          this.ctx.moveTo(centerX + arrowSize, centerY);
          this.ctx.lineTo(centerX, centerY + arrowSize/2);
          break;
      }
      this.ctx.stroke();
    }

    // 名字
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '10px Arial';
    this.ctx.fillText(op.name, op.pos.x + 10, op.pos.y + 20);
    
    // 血条（在角色上方）
    if (op.stats.hp < op.stats.maxHp || op.isRetreated) {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(op.pos.x + padding, op.pos.y - 10, size, 4);
        
        if (!op.isRetreated) {
            this.ctx.fillStyle = '#2ecc71';
            const hpRatio = Math.max(0, op.stats.hp / op.stats.maxHp);
            this.ctx.fillRect(op.pos.x + padding, op.pos.y - 10, size * hpRatio, 4);
        }
    }

    if (!op.isRetreated) {
        // 技力条（橙色，在血条下面）
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(op.pos.x + padding, op.pos.y - 6, size, 4);
        this.ctx.fillStyle = '#ff9500'; // 橙色
        const spRatio = Math.min(1, op.currentSp / op.skill.cost);
        this.ctx.fillRect(op.pos.x + padding, op.pos.y - 6, size * spRatio, 4);

        // 阻挡数
        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.font = '10px Arial';
        const blockText = `B:${op.blockingEnemyIds.length}/${op.stats.blockCount}`;
        this.ctx.fillText(blockText, op.pos.x + 10, op.pos.y + size);
    } else {
        this.ctx.fillStyle = '#e74c3c';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText("RETREAT", op.pos.x + 6, op.pos.y + size/2 + 4);
    }
  }

  private drawEnemy(enemy: any) {
    this.ctx.save();
    this.ctx.translate(enemy.pos.x, enemy.pos.y);
    
    this.ctx.fillStyle = enemy.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    this.ctx.fill();

    if(enemy.isBlockedBy) {
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(-12, -22, 24, 4);
    this.ctx.fillStyle = '#e67e22'; 
    this.ctx.fillRect(-12, -22, 24 * (enemy.stats.hp / enemy.stats.maxHp), 4);

    this.ctx.restore();
  }

  private drawProjectile(proj: any) {
    this.ctx.fillStyle = proj.color;
    this.ctx.beginPath();
    this.ctx.arc(proj.pos.x, proj.pos.y, 4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawPlacementOverlay(engine: GameEngine, templateId: string) {
    const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];
    if (!template) return;

    const targetType = template.placement === 'ground' ? 0 : 1;

    // 半透明绿色提示（可部署位置）
    this.ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
    
    for (let y = 0; y < CONFIG.MAP_HEIGHT; y++) {
      for (let x = 0; x < CONFIG.MAP_WIDTH; x++) {
        const isCorrectTerrain = MAP_LAYOUT[y][x] === targetType;
        const isOccupied = engine.operators.some(o => o.gridPos.x === x && o.gridPos.y === y);

        if (isCorrectTerrain && !isOccupied) {
          // 绘制可部署位置
          this.ctx.fillRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
          this.ctx.strokeStyle = '#2ecc71';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(x * CONFIG.TILE_SIZE, y * CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
        }
      }
    }
  }

  // 绘制待部署的角色预览
  private drawPendingDeployment(engine: GameEngine, previewDirection?: Direction | null) {
    if (!engine.pendingDeployment) return;
    
    const { gridX, gridY, templateId } = engine.pendingDeployment;
    const template = OPERATOR_DB[templateId as keyof typeof OPERATOR_DB];
    if (!template) return;

    const direction = previewDirection || 'down'; // 默认向下
    
    // 绘制角色预览（半透明）
    const padding = 6;
    const size = CONFIG.TILE_SIZE - padding * 2;
    const posX = gridX * CONFIG.TILE_SIZE;
    const posY = gridY * CONFIG.TILE_SIZE;
    
    this.ctx.fillStyle = template.color;
    this.ctx.globalAlpha = 0.6;
    this.ctx.fillRect(posX + padding, posY + padding, size, size);
    this.ctx.globalAlpha = 1.0;

    // 绘制朝向箭头
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    const centerX = posX + CONFIG.TILE_SIZE / 2;
    const centerY = posY + CONFIG.TILE_SIZE / 2;
    const arrowSize = 12;
    
    switch (direction) {
      case 'up':
        this.ctx.moveTo(centerX, centerY - arrowSize);
        this.ctx.lineTo(centerX - arrowSize/2, centerY);
        this.ctx.moveTo(centerX, centerY - arrowSize);
        this.ctx.lineTo(centerX + arrowSize/2, centerY);
        break;
      case 'down':
        this.ctx.moveTo(centerX, centerY + arrowSize);
        this.ctx.lineTo(centerX - arrowSize/2, centerY);
        this.ctx.moveTo(centerX, centerY + arrowSize);
        this.ctx.lineTo(centerX + arrowSize/2, centerY);
        break;
      case 'left':
        this.ctx.moveTo(centerX - arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY - arrowSize/2);
        this.ctx.moveTo(centerX - arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY + arrowSize/2);
        break;
      case 'right':
        this.ctx.moveTo(centerX + arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY - arrowSize/2);
        this.ctx.moveTo(centerX + arrowSize, centerY);
        this.ctx.lineTo(centerX, centerY + arrowSize/2);
        break;
    }
    this.ctx.stroke();

    // 绘制攻击范围预览
    const rangeTiles = getAttackRangeTiles({ x: gridX, y: gridY }, direction, template.placement, template.stats.range);
    this.ctx.fillStyle = 'rgba(255, 200, 0, 0.3)'; // 黄色半透明
    rangeTiles.forEach(tile => {
      this.ctx.fillRect(
        tile.x * CONFIG.TILE_SIZE,
        tile.y * CONFIG.TILE_SIZE,
        CONFIG.TILE_SIZE,
        CONFIG.TILE_SIZE
      );
      this.ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(
        tile.x * CONFIG.TILE_SIZE,
        tile.y * CONFIG.TILE_SIZE,
        CONFIG.TILE_SIZE,
        CONFIG.TILE_SIZE
      );
    });
  }
}