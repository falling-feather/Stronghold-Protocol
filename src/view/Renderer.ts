import { GameEngine } from '../core/GameEngine';
import { CONFIG, MAP_LAYOUT, OPERATOR_DB } from '../config/gameData';
import { Direction } from '../types';
import { getAttackRangeTiles } from '../core/MathUtils';
import { drawBattleMap } from './BattleMap';
import { loadedPortrait } from './OperatorArt';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  private mapWidth = CONFIG.MAP_WIDTH;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(mapWidth = this.mapWidth) {
    this.mapWidth = mapWidth;
    const width = mapWidth * CONFIG.TILE_SIZE;
    const height = CONFIG.MAP_HEIGHT * CONFIG.TILE_SIZE;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  // 修改：增加 highlightTemplateId 参数，用于绘制部署热力图
  render(engine: GameEngine, highlightTemplateId?: string | null, highlightDirection?: Direction | null) {
    const mapWidth = engine.battlefield?.layout[0].length ?? CONFIG.MAP_WIDTH;
    if (mapWidth !== this.mapWidth) this.resize(mapWidth);
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    drawBattleMap(this.ctx, engine.battlefield);
    
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
    // v3.18.0：命中闪光（按 ttl 比例画半透明扩散圆）
    engine.hitFlashes.forEach(f => {
      const ratio = Math.max(0, f.ttl / f.maxTtl);
      const radius = 6 + (1 - ratio) * 14;
      this.ctx.save();
      this.ctx.globalAlpha = ratio * 0.85;
      this.ctx.strokeStyle = f.color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(f.pos.x, f.pos.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    });
    // v3.18.0：silencer 在场提示条
    if (engine.enemies.some(e => !e.markedForDeletion && e.traits?.healSuppress)) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(127, 140, 141, 0.85)';
      const w = 220, h = 30;
      const x = (this.mapWidth * CONFIG.TILE_SIZE - w) / 2;
      this.ctx.fillRect(x, 8, w, h);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('⚠ 医疗被压制（治疗 ×0.5）', x + w / 2, 8 + h / 2);
      this.ctx.restore();
    }
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
    const portrait = loadedPortrait(op.templateId);
    if (portrait) {
      this.ctx.save();
      this.ctx.globalAlpha = op.isRetreated ? 0.35 : 0.8;
      this.ctx.drawImage(portrait, op.pos.x + padding, op.pos.y + padding, size, size);
      this.ctx.restore();
    }
    if (op.rank === 2) {
      this.ctx.strokeStyle = '#f1c40f';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(op.pos.x + padding, op.pos.y + padding, size, size);
    }

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
    this.ctx.fillText(op.name, op.pos.x + 10, op.pos.y + 20, size - 8);
    
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

    // v2.4.0：飞行投影
    if (enemy.traits?.flying) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.35)';
      this.ctx.beginPath();
      this.ctx.ellipse(0, enemy.radius + 6, enemy.radius * 0.7, enemy.radius * 0.25, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.translate(0, -8); // 抬起本体表示飞行
    }

    // v2.4.0：Boss 阶段红色光环
    if (enemy.bossPhaseTriggered) {
      this.ctx.strokeStyle = 'rgba(255,80,80,0.85)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // v2.4.0：隐身半透明
    this.ctx.globalAlpha = enemy.traits?.stealth ? 0.45 : 1;
    this.ctx.fillStyle = enemy.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalAlpha = 1;

    if(enemy.isBlockedBy) {
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    this.ctx.fillStyle = 'red';
    this.ctx.fillRect(-12, -22, 24, 4);
    this.ctx.fillStyle = '#e67e22'; 
    this.ctx.fillRect(-12, -22, 24 * (enemy.stats.hp / enemy.stats.maxHp), 4);

    // v3.10.0：护盾条（在血条上方，蓝色）
    const maxShield = enemy.traits?.shield ?? 0;
    const curShield = enemy.currentShield ?? 0;
    if (maxShield > 0 && curShield > 0) {
      this.ctx.fillStyle = '#1c3d5a';
      this.ctx.fillRect(-12, -27, 24, 3);
      this.ctx.fillStyle = '#3498db';
      this.ctx.fillRect(-12, -27, 24 * (curShield / maxShield), 3);
    }

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
