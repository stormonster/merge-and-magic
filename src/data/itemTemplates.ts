import { BaseItemTemplate } from '../game/types';

const weaponIcons = Array.from({ length: 14 }, (_, index) => `items/weapons/weapon-${String(index + 1).padStart(2, '0')}.png`);

const helmetIcons = ['armor-01', 'armor-02', 'armor-03', 'armor-04'].map((name) => `items/armor/${name}.png`);
const chestIcons = ['armor-05', 'armor-06', 'armor-07', 'armor-08'].map((name) => `items/armor/${name}.png`);
const gloveIcons = ['armor-09', 'armor-10', 'armor-11', 'armor-12'].map((name) => `items/armor/${name}.png`);
const bootIcons = ['armor-13', 'armor-14', 'armor-15', 'armor-16'].map((name) => `items/armor/${name}.png`);

const offhandIcons = ['accessory-01', 'accessory-02', 'accessory-03', 'accessory-04', 'accessory-05'].map(
  (name) => `items/accessories/${name}.png`
);
const amuletIcons = ['accessory-06', 'accessory-07', 'accessory-08', 'accessory-14', 'accessory-15', 'accessory-16'].map(
  (name) => `items/accessories/${name}.png`
);
const ringIcons = ['accessory-09', 'accessory-10', 'accessory-11', 'accessory-12'].map((name) => `items/accessories/${name}.png`);

export const ITEM_TEMPLATES: BaseItemTemplate[] = [
  { namePrefix: 'Debug Blade', slot: 'weapon', icon: weaponIcons[0], iconPool: weaponIcons, statBias: 'debugging' },
  { namePrefix: 'Focus Hood', slot: 'helmet', icon: helmetIcons[1], iconPool: helmetIcons, statBias: 'focus' },
  { namePrefix: 'Merge Shield', slot: 'offhand', icon: offhandIcons[0], iconPool: offhandIcons, statBias: 'resilience' },
  { namePrefix: 'Agile Gloves', slot: 'gloves', icon: gloveIcons[2], iconPool: gloveIcons, statBias: 'velocity' },
  { namePrefix: 'Stack Boots', slot: 'boots', icon: bootIcons[0], iconPool: bootIcons, statBias: 'architecture' },
  { namePrefix: 'Coffee Amulet', slot: 'amulet', icon: amuletIcons[0], iconPool: amuletIcons, statBias: 'focus' },
  { namePrefix: 'Binary Ring', slot: 'ring1', icon: ringIcons[0], iconPool: ringIcons, statBias: 'luck' },
  { namePrefix: 'Compile Ring', slot: 'ring2', icon: ringIcons[1], iconPool: ringIcons, statBias: 'debugging' },
  { namePrefix: 'Task Chestplate', slot: 'chest', icon: chestIcons[1], iconPool: chestIcons, statBias: 'resilience' }
];
