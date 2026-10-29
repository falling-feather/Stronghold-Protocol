import { EquipmentItem, StatusEffect, StatusStat } from '../types';

export interface EquipmentDefinition {
  name: string;
  cost: number;
  stat: StatusStat;
  modType: 'flat' | 'pct';
  values: [number, number];
  description: [string, string];
}

// PRTS 卫戍协议：盟约装备数据库，Ⅰ阶基础与进阶品质。
export const EQUIPMENT_DB: Record<string, EquipmentDefinition> = {
  victoria_hammer: { name: '维式重锤', cost: 1, stat: 'atk', modType: 'pct', values: [0.1, 0.2],
    description: ['攻击力 +10%', '攻击力 +20%'] },
  defense_shield: { name: '坚守盾牌', cost: 1, stat: 'def', modType: 'pct', values: [0.35, 0.6],
    description: ['防御力 +35%', '防御力 +60%'] },
  pocket_array: { name: '口袋法阵', cost: 2, stat: 'magicResist', modType: 'flat', values: [20, 35],
    description: ['法术抗性 +20', '法术抗性 +35'] },
};

export function equipmentEffect(item: EquipmentItem): StatusEffect {
  const def = EQUIPMENT_DB[item.templateId];
  return { id: `equipment_${item.uid}`, name: `${def.name}${item.rank === 2 ? '·进阶' : ''}`, kind: 'buff',
    stat: def.stat, mod: def.values[item.rank - 1], modType: def.modType, duration: -1, remaining: -1 };
}
