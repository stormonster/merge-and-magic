# Auto Looter RPG for VS Code — Build Spec

## 1. Vision

Build a small auto-looter RPG that runs inside VS Code as an extension. The game rewards real development work with encounters, loot, XP, and progression.

The player does not manually manage loot. Instead, equipment slots are either locked or unlocked:

- Locked slots protect the currently equipped item, but any new loot for that slot is discarded.
- Unlocked slots automatically equip any new loot for that slot, even if the new item is worse.

This creates the core risk/reward loop:

> Lock to protect. Unlock to gamble.

The game should feel lightweight, fast, charming, and satisfying after real work events such as commits, passing tests, or focused coding sessions.

---

## 2. Core Game Loop

1. User works in VS Code.
2. Extension detects a productivity trigger.
3. Trigger may create an encounter or loot event.
4. Encounter resolves automatically.
5. Player receives XP, gold, and/or loot.
6. Loot is automatically handled by the lock/unlock equipment rules.
7. UI updates equipment, character stats, and event log.

Example loop:

```text
Commit created
→ Encounter triggered
→ Fight Bug Goblin
→ Win
→ Drop: Rare Debug Blade, ilvl 8
→ Weapon slot is unlocked
→ Debug Blade automatically equips, replacing Old Keyboard Sword
```

---

## 3. MVP Scope

The first version should include:

- VS Code extension written in TypeScript.
- Webview panel showing character, equipment slots, and activity log.
- Static AI-generated item icons stored locally in the extension.
- Equipment slots with lock/unlock toggle.
- Automatic loot pickup and equip logic.
- Greed bonus and lock debuff system.
- Random encounters.
- Auto-combat.
- XP and level progression.
- Local save state using VS Code global/workspace storage.
- Manual debug commands for testing encounters and loot.
- Optional Git commit trigger.

Do not build yet:

- Drag-and-drop inventory.
- Real-time AI image generation.
- Multiplayer.
- Cloud sync.
- Complex item comparison policies.
- Manual confirmation before replacing gear.

---

## 4. Productive Work Triggers

The game can later support many productivity triggers, but the MVP should start with manual commands plus Git commit detection if practical.

Recommended triggers:

### MVP triggers

- `Auto Looter: Open RPG Panel`
- `Auto Looter: Trigger Encounter`
- `Auto Looter: Drop Test Loot`
- `Auto Looter: Reset Save`
- Optional: Git commit detected.

### Later triggers

- Commit created.
- Tests passed.
- Pull request merged.
- Issue closed.
- 25-minute focus session completed.
- Documentation updated.
- Refactor streak.
- Daily work streak.

Avoid rewarding raw line count directly. It encourages bad behavior.

---

## 5. Main Design Rule: Auto Loot with Locked Slots

Each equipment slot has a lock state.

### If the slot is unlocked

The new item always equips.

This happens even if the new item has lower rarity, lower item level, or worse stats.

Example:

```text
Equipped: Rusty Merge Axe · Common · ilvl 4
Replaced: Debug Blade · Rare · ilvl 8
Reason: Weapon slot was unlocked
```

### If the slot is locked

The new item is always discarded.

Example:

```text
Missed: Nullguard Helm · Epic · ilvl 12
Reason: Helmet slot was locked
```

### Important

There should be no item comparison policy in the MVP.

Do not implement:

- Only higher rarity.
- Only higher item level.
- Only better stats.
- Confirmation dialog.

The risk is the point.

---

## 6. Greed Bonus and Lock Debuff

The player should be rewarded for leaving slots unlocked and slightly penalized for locking too many slots.

This reinforces the core risk/reward design.

### Definitions

- `unlockedSlotCount`: number of equipment slots that are not locked.
- `lockedSlotCount`: number of equipment slots that are locked.
- `totalSlotCount`: total number of equipment slots.

### Greed Bonus

Each unlocked slot increases loot luck.

Recommended MVP value:

```text
+2% loot chance per unlocked slot
```

Example:

```text
8 unlocked slots = +16% loot chance
```

### Lock Debuff

Each locked slot slightly reduces encounter reward quality.

Recommended MVP value:

```text
-1% rare drop chance per locked slot
```

Example:

```text
5 locked slots = -5% rare drop chance
```

### Suggested formula

```ts
const GREED_BONUS_PER_UNLOCKED_SLOT = 0.02;
const LOCK_DEBUFF_PER_LOCKED_SLOT = 0.01;

function getGreedBonus(unlockedSlotCount: number): number {
  return unlockedSlotCount * GREED_BONUS_PER_UNLOCKED_SLOT;
}

function getLockDebuff(lockedSlotCount: number): number {
  return lockedSlotCount * LOCK_DEBUFF_PER_LOCKED_SLOT;
}
```

### How to apply it

Use greed bonus to increase the chance that an encounter drops loot.

Use lock debuff to reduce the chance that loot rarity upgrades to rare, epic, legendary, etc.

Example:

```ts
finalLootDropChance = baseLootDropChance + greedBonus;
finalRarityUpgradeChance = baseRarityUpgradeChance - lockDebuff;
```

Clamp values so they do not go below or above reasonable limits.

```ts
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

Recommended caps:

```text
Loot drop chance: minimum 5%, maximum 95%
Rarity upgrade chance: minimum 1%, maximum 75%
```

---

## 7. Equipment Slots

Recommended MVP slots:

```text
helmet
chest
gloves
boots
weapon
offhand
amulet
ring1
ring2
```

Each slot should show:

- Slot name.
- Lock state.
- Current item icon.
- Current item name.
- Rarity.
- Item level.
- Main stats.

Slot lock can be toggled by clicking a button in the webview.

---

## 8. Data Models

### Rarity

```ts
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
```

### Equipment slot type

```ts
type EquipmentSlotType =
  | "helmet"
  | "chest"
  | "gloves"
  | "boots"
  | "weapon"
  | "offhand"
  | "amulet"
  | "ring1"
  | "ring2";
```

### Item

```ts
type Item = {
  id: string;
  name: string;
  slot: EquipmentSlotType;
  rarity: Rarity;
  itemLevel: number;
  icon: string;
  stats: Partial<PlayerStats>;
};
```

### Player stats

```ts
type PlayerStats = {
  focus: number;
  debugging: number;
  architecture: number;
  velocity: number;
  resilience: number;
  luck: number;
};
```

### Equipment slot

```ts
type EquipmentSlot = {
  slot: EquipmentSlotType;
  locked: boolean;
  item: Item | null;
};
```

### Player

```ts
type Player = {
  level: number;
  xp: number;
  gold: number;
  baseStats: PlayerStats;
  equipment: Record<EquipmentSlotType, EquipmentSlot>;
};
```

### Game log entry

```ts
type GameLogEntry = {
  id: string;
  createdAt: string;
  type: "encounter" | "loot_equipped" | "loot_missed" | "level_up" | "system";
  message: string;
};
```

### Game state

```ts
type GameState = {
  version: number;
  player: Player;
  log: GameLogEntry[];
};
```

---

## 9. Loot Handling Logic

Implement loot handling as a pure function so it is easy to test.

```ts
type LootResult =
  | {
      type: "equipped";
      item: Item;
      replacedItem: Item | null;
      message: string;
    }
  | {
      type: "missed";
      item: Item;
      message: string;
    };

function handleLootDrop(player: Player, item: Item): LootResult {
  const targetSlot = player.equipment[item.slot];

  if (!targetSlot) {
    throw new Error(`No equipment slot exists for item slot: ${item.slot}`);
  }

  if (targetSlot.locked) {
    return {
      type: "missed",
      item,
      message: `🔒 Missed: ${item.name} · ${item.rarity} · ilvl ${item.itemLevel}. Reason: ${item.slot} slot was locked.`
    };
  }

  const replacedItem = targetSlot.item;
  targetSlot.item = item;

  return {
    type: "equipped",
    item,
    replacedItem,
    message: replacedItem
      ? `⚔ Equipped: ${item.name} · ${item.rarity} · ilvl ${item.itemLevel}. Replaced: ${replacedItem.name}.`
      : `⚔ Equipped: ${item.name} · ${item.rarity} · ilvl ${item.itemLevel}.`
  };
}
```

---

## 10. Rarity System

Suggested rarity order:

```ts
const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic"
];
```

Suggested base drop weights:

```ts
const BASE_RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 0.9,
  mythic: 0.1
};
```

Apply lock debuff by shifting probability away from higher rarities.

MVP-friendly approach:

```ts
function getAdjustedRarityWeights(lockedSlotCount: number): Record<Rarity, number> {
  const debuff = getLockDebuff(lockedSlotCount);
  const highRarityPenalty = clamp(1 - debuff, 0.5, 1);

  return {
    common: BASE_RARITY_WEIGHTS.common + lockedSlotCount,
    uncommon: BASE_RARITY_WEIGHTS.uncommon,
    rare: BASE_RARITY_WEIGHTS.rare * highRarityPenalty,
    epic: BASE_RARITY_WEIGHTS.epic * highRarityPenalty,
    legendary: BASE_RARITY_WEIGHTS.legendary * highRarityPenalty,
    mythic: BASE_RARITY_WEIGHTS.mythic * highRarityPenalty
  };
}
```

This is intentionally simple. It makes too many locked slots reduce upside without making the game feel punishing.

---

## 11. Encounter System

Encounters should be automatic.

### Enemy model

```ts
type Enemy = {
  id: string;
  name: string;
  level: number;
  hp: number;
  attack: number;
  defense: number;
  xpReward: number;
  goldReward: number;
  baseLootDropChance: number;
};
```

### Example enemies

```json
[
  {
    "id": "bug_goblin",
    "name": "Bug Goblin",
    "level": 1,
    "hp": 12,
    "attack": 3,
    "defense": 1,
    "xpReward": 10,
    "goldReward": 3,
    "baseLootDropChance": 0.35
  },
  {
    "id": "merge_conflict_wraith",
    "name": "Merge Conflict Wraith",
    "level": 3,
    "hp": 26,
    "attack": 6,
    "defense": 2,
    "xpReward": 25,
    "goldReward": 8,
    "baseLootDropChance": 0.45
  }
]
```

### Encounter names

Good theme examples:

- Bug Goblin
- Merge Conflict Wraith
- Dependency Slime
- Null Pointer Imp
- Deadline Rat
- TODO Skeleton
- Legacy Code Golem
- Flaky Test Phantom
- Production Dragon
- Scope Creep Hydra

---

## 12. Auto Combat

Keep combat very simple in the MVP.

Calculate player power from level and equipped items.

```ts
function getTotalStats(player: Player): PlayerStats {
  const total = { ...player.baseStats };

  for (const slot of Object.values(player.equipment)) {
    if (!slot.item) continue;

    for (const [stat, value] of Object.entries(slot.item.stats)) {
      const key = stat as keyof PlayerStats;
      total[key] += value ?? 0;
    }
  }

  return total;
}
```

Simple win chance:

```ts
function calculateWinChance(player: Player, enemy: Enemy): number {
  const stats = getTotalStats(player);
  const playerPower =
    player.level * 5 +
    stats.focus * 1.2 +
    stats.debugging * 1.5 +
    stats.architecture * 1.1 +
    stats.velocity * 1.0 +
    stats.resilience * 1.3 +
    stats.luck * 0.8;

  const enemyPower = enemy.level * 5 + enemy.hp * 0.5 + enemy.attack * 2 + enemy.defense;

  return clamp(playerPower / (playerPower + enemyPower), 0.1, 0.9);
}
```

If the player wins:

- Gain XP.
- Gain gold.
- Roll for loot drop.

If the player loses:

- Add log message.
- No permanent penalty in MVP.

---

## 13. Loot Drop Formula

```ts
function getLootDropChance(player: Player, enemy: Enemy): number {
  const slots = Object.values(player.equipment);
  const unlockedSlotCount = slots.filter(slot => !slot.locked).length;
  const greedBonus = getGreedBonus(unlockedSlotCount);

  return clamp(enemy.baseLootDropChance + greedBonus, 0.05, 0.95);
}
```

Example:

```text
Base enemy loot chance: 35%
Unlocked slots: 6
Greed bonus: +12%
Final loot chance: 47%
```

---

## 14. Item Generation

Generate items from templates.

### Item template

```ts
type ItemTemplate = {
  id: string;
  namePrefix: string;
  slot: EquipmentSlotType;
  icon: string;
  statBias: keyof PlayerStats;
};
```

### Example templates

```json
[
  {
    "id": "debug_blade",
    "namePrefix": "Debug Blade",
    "slot": "weapon",
    "icon": "debug_blade.png",
    "statBias": "debugging"
  },
  {
    "id": "focus_hood",
    "namePrefix": "Focus Hood",
    "slot": "helmet",
    "icon": "focus_hood.png",
    "statBias": "focus"
  },
  {
    "id": "merge_shield",
    "namePrefix": "Merge Shield",
    "slot": "offhand",
    "icon": "merge_shield.png",
    "statBias": "resilience"
  }
]
```

### Generate item

```ts
function generateItem(playerLevel: number, rarity: Rarity, template: ItemTemplate): Item {
  const rarityMultiplier: Record<Rarity, number> = {
    common: 1,
    uncommon: 1.25,
    rare: 1.6,
    epic: 2.1,
    legendary: 2.8,
    mythic: 3.6
  };

  const itemLevel = Math.max(1, playerLevel + randomInt(-1, 2));
  const mainStatValue = Math.ceil(itemLevel * rarityMultiplier[rarity]);

  return {
    id: `${template.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: `${rarityLabel(rarity)} ${template.namePrefix}`,
    slot: template.slot,
    rarity,
    itemLevel,
    icon: template.icon,
    stats: {
      [template.statBias]: mainStatValue
    }
  };
}
```

---

## 15. Visual Inventory

Use a VS Code webview.

### Layout

Recommended layout:

```text
Character Panel
────────────────────────
Level 4 · XP 85/120 · Gold 33
Greed Bonus: +12% loot chance
Lock Debuff: -3% rare chance

Equipment
────────────────────────
[Helmet] [Amulet]
[Chest]
[Weapon] [Offhand]
[Gloves] [Ring 1] [Ring 2]
[Boots]

Activity Log
────────────────────────
⚔ Defeated Bug Goblin
⚔ Equipped Debug Blade · Rare · ilvl 8
🔒 Missed Nullguard Helm · Epic · ilvl 10 because Helmet was locked
```

### Slot design

Each slot card should include:

- Slot label.
- Lock/unlock button.
- Item icon.
- Item name.
- Rarity.
- Item level.
- Stats.

### Rarity classes

Use CSS classes:

```css
.rarity-common {}
.rarity-uncommon {}
.rarity-rare {}
.rarity-epic {}
.rarity-legendary {}
.rarity-mythic {}
```

The exact colors can be tuned later.

---

## 16. Static AI-Generated Icons

Do not generate images during gameplay.

Instead:

1. Generate a small item icon pack manually.
2. Save images into the extension, for example:

```text
media/items/debug_blade.png
media/items/focus_hood.png
media/items/merge_shield.png
media/items/coffee_amulet.png
```

3. Item templates reference icon filenames.
4. Webview loads icons from the extension media folder.

Recommended first icon pack:

- 5 weapons.
- 3 helmets.
- 3 chest pieces.
- 3 gloves.
- 3 boots.
- 3 offhands.
- 3 amulets.
- 5 rings.

Total: about 28 icons. That is enough for a strong MVP.

---

## 17. VS Code Extension Structure

Recommended structure:

```text
auto-looter-rpg/
  package.json
  tsconfig.json
  src/
    extension.ts
    game/
      types.ts
      state.ts
      equipment.ts
      loot.ts
      rarity.ts
      encounters.ts
      combat.ts
      progression.ts
      random.ts
    webview/
      panel.ts
      html.ts
  media/
    items/
      debug_blade.png
      focus_hood.png
    styles/
      inventory.css
  data/
    enemies.json
    itemTemplates.json
```

---

## 18. VS Code Commands

Add these commands in `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "autoLooter.openPanel",
        "title": "Auto Looter: Open RPG Panel"
      },
      {
        "command": "autoLooter.triggerEncounter",
        "title": "Auto Looter: Trigger Encounter"
      },
      {
        "command": "autoLooter.dropTestLoot",
        "title": "Auto Looter: Drop Test Loot"
      },
      {
        "command": "autoLooter.resetSave",
        "title": "Auto Looter: Reset Save"
      }
    ]
  }
}
```

---

## 19. Webview Message Passing

The webview should send messages to the extension when the user clicks lock/unlock.

### Webview to extension

```ts
vscode.postMessage({
  type: "toggleSlotLock",
  slot: "weapon"
});
```

### Extension handler

```ts
panel.webview.onDidReceiveMessage(message => {
  switch (message.type) {
    case "toggleSlotLock":
      toggleSlotLock(gameState.player, message.slot);
      saveGameState(context, gameState);
      refreshWebview();
      break;
  }
});
```

---

## 20. State Persistence

Use `context.globalState` for MVP.

```ts
const SAVE_KEY = "autoLooterRpg.save";

async function saveGameState(context: vscode.ExtensionContext, state: GameState) {
  await context.globalState.update(SAVE_KEY, state);
}

function loadGameState(context: vscode.ExtensionContext): GameState {
  return context.globalState.get<GameState>(SAVE_KEY) ?? createInitialGameState();
}
```

Use `workspaceState` later if saves should be unique per project.

---

## 21. Initial Player State

```ts
function createInitialGameState(): GameState {
  return {
    version: 1,
    player: {
      level: 1,
      xp: 0,
      gold: 0,
      baseStats: {
        focus: 5,
        debugging: 5,
        architecture: 5,
        velocity: 5,
        resilience: 5,
        luck: 5
      },
      equipment: createInitialEquipment()
    },
    log: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: "system",
        message: "Adventure started. Lock to protect. Unlock to gamble."
      }
    ]
  };
}
```

---

## 22. XP and Leveling

Simple XP curve:

```ts
function xpRequiredForNextLevel(level: number): number {
  return 50 + level * level * 25;
}
```

On level up:

- Increase level by 1.
- Subtract required XP.
- Add small stat bonus.
- Log the level up.

```ts
function applyXp(player: Player, amount: number): string[] {
  const messages: string[] = [];
  player.xp += amount;

  while (player.xp >= xpRequiredForNextLevel(player.level)) {
    player.xp -= xpRequiredForNextLevel(player.level);
    player.level += 1;
    player.baseStats.focus += 1;
    player.baseStats.resilience += 1;
    messages.push(`⬆ Level up! You are now level ${player.level}.`);
  }

  return messages;
}
```

---

## 23. Activity Log

Keep only the latest 100 log entries.

```ts
function addLog(state: GameState, type: GameLogEntry["type"], message: string) {
  state.log.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    message
  });

  state.log = state.log.slice(0, 100);
}
```

---

## 24. Git Commit Trigger

MVP can work without automatic Git detection, but this is the desired direction.

Possible approaches:

### Simple approach

Register a command that the user runs after a commit:

```text
Auto Looter: Adventure Commit
```

This avoids complexity and is good enough for the first playable version.

### Better approach

Use VS Code Git extension API to detect repository state changes.

Pseudo-flow:

1. Access built-in Git extension.
2. Watch repository HEAD changes.
3. When HEAD commit hash changes, trigger encounter roll.
4. Apply cooldown so repeated state changes do not spam encounters.

Important anti-spam rules:

- One commit-triggered encounter every 5 minutes max.
- Ignore empty or repeated commit hashes.
- Store last seen commit hash.

---

## 25. Anti-Spam and Balance

Add simple cooldowns.

```ts
type Cooldowns = {
  lastEncounterAt: string | null;
  lastCommitHash: string | null;
};
```

Recommended cooldowns:

```text
Manual test encounter: no cooldown in development mode
Commit encounter: 5 minutes
Focus session encounter: 25 minutes
```

Do not overbuild anti-cheat. This is a personal productivity toy, not a competitive game.

---

## 26. Example Log Messages

```text
⚔ Encounter: Bug Goblin appeared after your commit.
✅ Victory: Defeated Bug Goblin. Gained 10 XP and 3 gold.
🎲 Greed Bonus: 6 unlocked slots gave +12% loot chance.
⚔ Equipped: Debug Blade · Rare · ilvl 8. Replaced: Rusty Keyboard Sword.
🔒 Missed: Nullguard Helm · Epic · ilvl 10. Reason: Helmet slot was locked.
⬆ Level up! You are now level 3.
```

---

## 27. Development Steps for an IDE AI Agent

Build in this order.

### Step 1: Create VS Code extension scaffold

Use TypeScript VS Code extension template.

Expected result:

- Extension activates.
- Commands register.
- `Auto Looter: Open RPG Panel` opens a webview.

### Step 2: Add game types and initial state

Create:

- `types.ts`
- `state.ts`
- `equipment.ts`

Expected result:

- Initial player state can be created.
- Game state can be saved and loaded.

### Step 3: Build webview UI

Create equipment grid and log display.

Expected result:

- Player level, XP, gold visible.
- Slots visible.
- Lock/unlock state visible.
- Empty slots render correctly.

### Step 4: Implement lock toggle

Add webview message passing.

Expected result:

- Clicking lock button toggles slot state.
- State persists after reopening VS Code.

### Step 5: Implement loot generation

Create:

- `rarity.ts`
- `loot.ts`
- `itemTemplates.json`

Expected result:

- Debug command can generate one random item.

### Step 6: Implement auto-equip logic

Add `handleLootDrop`.

Expected result:

- Unlocked slots replace current item.
- Locked slots discard loot and log missed item.

### Step 7: Add greed bonus and lock debuff

Display both in UI.

Expected result:

- More unlocked slots increases loot drop chance.
- More locked slots reduces high-rarity chance.

### Step 8: Implement encounters and combat

Create:

- `encounters.ts`
- `combat.ts`
- `enemies.json`

Expected result:

- Debug command triggers an encounter.
- Encounter resolves automatically.
- XP/gold/loot are awarded on victory.

### Step 9: Polish visuals

Add:

- Item icons.
- Rarity borders.
- Better slot layout.
- Better log formatting.

### Step 10: Add optional Git trigger

Add commit detection if time allows.

Expected result:

- Commit changes can trigger encounter roll with cooldown.

---

## 28. Acceptance Criteria

The MVP is complete when:

- The extension opens an RPG panel in VS Code.
- Player state persists.
- Equipment slots can be locked/unlocked.
- Loot automatically equips into unlocked slots.
- Loot is discarded from locked slots.
- Missed loot messages include item name, rarity, and item level.
- Greed bonus increases loot chance based on unlocked slots.
- Lock debuff reduces rare drop chance based on locked slots.
- Encounters can be triggered manually.
- Auto-combat can reward XP, gold, and loot.
- The UI displays current equipment and recent activity.

---

## 29. Design Principles

Keep these rules strict:

1. Automation first.
2. No inventory micromanagement.
3. No drag-and-drop.
4. No real-time image generation.
5. Locked means safe but misses loot.
6. Unlocked means greedy but risky.
7. Never ask for confirmation before replacing gear.
8. Make every work trigger feel rewarding.
9. Keep logs juicy and readable.
10. Build the fun core before adding complexity.

---

## 30. Suggested Name Ideas

- CommitQuest
- Loot Loop
- Merge & Magic
- Debug Dungeon
- Git Goblin
- Repo Raiders
- Push to Plunder
- Legendary Commit

---

## 31. One-Sentence Pitch

A VS Code auto-looter RPG where real coding work triggers encounters, loot auto-equips into unlocked slots, locked slots protect your favorite gear, and greedier players get better loot chances at the risk of replacing good items.
