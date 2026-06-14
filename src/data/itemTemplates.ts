import { BaseItemTemplate } from '../game/types';

function itemIcon(folder: string, name: string): string {
  return `items/${folder}/${name}.png`;
}

function variant(folder: string, iconName: string, namePrefix: string, noun = namePrefix) {
  return {
    namePrefix,
    icon: itemIcon(folder, iconName),
    noun
  };
}

const weaponVariants = [
  variant('weapons', 'weapon-01', 'Debug Longsword'),
  variant('weapons', 'weapon-02', 'Refactor Axe'),
  variant('weapons', 'weapon-03', 'Breakpoint Dagger'),
  variant('weapons', 'weapon-04', 'Null Mace'),
  variant('weapons', 'weapon-05', 'Runtime Hammer'),
  variant('weapons', 'weapon-06', 'Focus Wand'),
  variant('weapons', 'weapon-07', 'Review Scepter'),
  variant('weapons', 'weapon-08', 'Merge Scythe'),
  variant('weapons', 'weapon-09', 'Trace Knife'),
  variant('weapons', 'weapon-10', 'Deploy Hatchet'),
  variant('weapons', 'weapon-11', 'Compile Saber'),
  variant('weapons', 'weapon-12', 'Async Rod'),
  variant('weapons', 'weapon-13', 'Daemon Staff'),
  variant('weapons', 'weapon-14', 'Scripted Tomeblade')
];

const helmetVariants = [
  variant('armor', 'armor-01', 'Debug Helm'),
  variant('armor', 'armor-02', 'Focus Hood'),
  variant('armor', 'armor-03', 'Build Visor'),
  variant('armor', 'armor-04', 'Plague Mask')
];

const chestVariants = [
  variant('armor', 'armor-05', 'Task Robe'),
  variant('armor', 'armor-06', 'Stack Jerkin'),
  variant('armor', 'armor-07', 'Chainmail Harness'),
  variant('armor', 'armor-08', 'Merge Chestplate')
];

const gloveVariants = [
  variant('armor', 'armor-09', 'Patchwork Gloves'),
  variant('armor', 'armor-10', 'Steel Grips'),
  variant('armor', 'armor-11', 'Agile Gloves'),
  variant('armor', 'armor-12', 'Golden Gauntlets')
];

const bootVariants = [
  variant('armor', 'armor-13', 'Stack Boots'),
  variant('armor', 'armor-14', 'Iron Greaves'),
  variant('armor', 'armor-15', 'Guard Boots'),
  variant('armor', 'armor-16', 'Runner Wraps')
];

const offhandVariants = [
  variant('accessories', 'accessory-01', 'Merge Shield'),
  variant('accessories', 'accessory-02', 'Round Buckler'),
  variant('accessories', 'accessory-03', 'Compile Tome'),
  variant('accessories', 'accessory-04', 'Refactor Grimoire'),
  variant('accessories', 'accessory-05', 'Runtime Orb')
];

const amuletVariants = [
  variant('accessories', 'accessory-06', 'Emerald Amulet'),
  variant('accessories', 'accessory-07', 'Ruby Pendant'),
  variant('accessories', 'accessory-08', 'Spiral Medallion'),
  variant('accessories', 'accessory-14', 'Task Charm'),
  variant('accessories', 'accessory-15', 'Ivory Talisman'),
  variant('accessories', 'accessory-16', 'Skull Medallion')
];

const ringVariants = [
  variant('accessories', 'accessory-09', 'Sapphire Ring'),
  variant('accessories', 'accessory-10', 'Emerald Band'),
  variant('accessories', 'accessory-11', 'Signet Ring'),
  variant('accessories', 'accessory-12', 'Amethyst Ring')
];

export const ITEM_TEMPLATES: BaseItemTemplate[] = [
  { namePrefix: weaponVariants[0].namePrefix, slot: 'weapon', icon: weaponVariants[0].icon, visualVariants: weaponVariants, statBias: 'debugging' },
  { namePrefix: helmetVariants[1].namePrefix, slot: 'helmet', icon: helmetVariants[1].icon, visualVariants: helmetVariants, statBias: 'focus' },
  { namePrefix: offhandVariants[0].namePrefix, slot: 'offhand', icon: offhandVariants[0].icon, visualVariants: offhandVariants, statBias: 'resilience' },
  { namePrefix: gloveVariants[2].namePrefix, slot: 'gloves', icon: gloveVariants[2].icon, visualVariants: gloveVariants, statBias: 'velocity' },
  { namePrefix: bootVariants[0].namePrefix, slot: 'boots', icon: bootVariants[0].icon, visualVariants: bootVariants, statBias: 'architecture' },
  { namePrefix: amuletVariants[0].namePrefix, slot: 'amulet', icon: amuletVariants[0].icon, visualVariants: amuletVariants, statBias: 'focus' },
  { namePrefix: ringVariants[0].namePrefix, slot: 'ring1', icon: ringVariants[0].icon, visualVariants: ringVariants, statBias: 'luck' },
  { namePrefix: ringVariants[1].namePrefix, slot: 'ring2', icon: ringVariants[1].icon, visualVariants: ringVariants, statBias: 'debugging' },
  { namePrefix: chestVariants[1].namePrefix, slot: 'chest', icon: chestVariants[1].icon, visualVariants: chestVariants, statBias: 'resilience' }
];
