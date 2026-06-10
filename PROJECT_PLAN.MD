# Merge & Magic MVP Development Plan

## Overview
Build a maintainable MVP of Merge & Magic as a VS Code extension. The game is a lightweight auto-looter RPG where development activity drives RPG progression.

Key principles:
- Keep architecture simple.
- Avoid overengineering.
- Prefer plain TypeScript and built-in VS Code APIs.
- Keep gameplay logic separate from UI rendering.
- Use clear folder structure and naming.

## Architecture and Folder Structure
Root layout:

- `package.json`
- `tsconfig.json`
- `src/extension.ts`
- `src/game/`
- `src/ui/`
- `src/data/`
- `src/storage/`
- `src/git/`
- `assets/`
- `media/`

Detailed structure:

- `src/extension.ts`
- `src/game/types.ts`
- `src/game/state.ts`
- `src/game/engine.ts`
- `src/game/loot.ts`
- `src/game/encounters.ts`
- `src/game/combat.ts`
- `src/game/progression.ts`
- `src/game/random.ts`
- `src/ui/webviewPanel.ts`
- `src/ui/webviewHtml.ts`
- `src/ui/messageHandlers.ts`
- `src/storage/save.ts`
- `src/git/gitIntegration.ts`
- `src/data/enemies.ts`
- `src/data/itemTemplates.ts`
- `media/styles/webview.css`
- `assets/placeholder.png`

## Data Models

### Rarity

```ts
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
```

### EquipmentSlotType

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

### PlayerStats

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

### EquipmentSlot

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

### GameLogEntry

```ts
type GameLogEntry = {
  id: string;
  createdAt: string;
  type: "encounter" | "loot_equipped" | "loot_missed" | "level_up" | "system";
  message: string;
};
```

### GameState

```ts
type GameState = {
  version: number;
  player: Player;
  log: GameLogEntry[];
  cooldowns: {
    lastEncounterAt: string | null;
    lastCommitHash: string | null;
  };
};
```

## Save System

- Use `context.globalState` for MVP persistence.
- Save after every state change.
- Load on activation and fallback to initial state.
- Keep logs capped to latest 100 entries.
- Persist `lastCommitHash` and `lastEncounterAt` for optional Git cooldown.

Example save flow:

```ts
const SAVE_KEY = "mergeMagic.gameState";
await context.globalState.update(SAVE_KEY, state);
```

## VS Code Extension Architecture

### Activation
- Load or initialize game state.
- Register commands:
  - `mergeMagic.openPanel`
  - `mergeMagic.triggerEncounter`
  - `mergeMagic.dropTestLoot`
  - `mergeMagic.resetSave`
- Create or reveal the webview panel.
- Optionally register Git watcher.

### Runtime State
- One in-memory `GameState` object.
- Pure game engine functions mutate the state.
- Save after mutations.
- Notify webview on state updates.

### Webview
- `webviewPanel.createOrShow(context, state)`
- Listen for messages from webview.
- Post state updates back to webview.

### Commands
- `openPanel` opens UI.
- `triggerEncounter` runs a debug encounter.
- `dropTestLoot` generates test loot.
- `resetSave` restores initial state.

## Game Engine Responsibilities

- All gameplay logic in `src/game/*`.
- UI only renders state and dispatches actions.
- Engine modules:
  - `types.ts`
  - `state.ts`
  - `engine.ts`
  - `loot.ts`
  - `encounters.ts`
  - `combat.ts`
  - `progression.ts`
  - `random.ts`

## Loot and Equip Logic

- Unlocked slot = equip item.
- Locked slot = discard item.
- Use pure `handleLootDrop(player, item)`.
- No item comparisons or confirmations.
- Greed bonus and lock debuff:
  - `greedBonus = unlockedSlotCount * 0.02`
  - `lockDebuff = lockedSlotCount * 0.01`
- Clamp:
  - Loot drop chance 5% to 95%
  - Rarity upgrade chance 1% to 75%

## Encounter and Combat Flow

- Choose enemy from static list.
- Compute win chance from player stats and enemy power.
- Resolve immediately.
- On win:
  - award XP and gold
  - roll for loot
  - generate item
  - equip or miss based on lock state
- On loss:
  - log defeat
  - no permanent penalty

## Git Integration Approach

### MVP approach
- Keep Git optional.
- Primary MVP uses manual commands.

### Optional Git trigger
- Use built-in Git API if available.
- Detect HEAD commit hash changes.
- Trigger encounter on new commit.
- Apply cooldown: 5 minutes max.
- Ignore repeated commit hashes.

## Webview Architecture

### Responsibilities
- Render `GameState`.
- Display equipment and log.
- Send actions to extension.

### Message contract
- From webview:
  - `toggleSlotLock`
  - `requestStateRefresh`
  - optional debug commands
- From extension:
  - `stateUpdate`
  - `systemMessage`

### UI layout
- Header with level, XP, gold.
- Greed bonus and lock debuff.
- Equipment grid.
- Activity log.
- Slot cards with lock button and item details.

### Implementation
- HTML builder in `src/ui/webviewHtml.ts`
- Plain DOM scripting.
- CSS in `media/styles/webview.css`
- Use rarity classes.

## Implementation Milestones

1. Scaffold extension and open webview.
2. Add game models and persistence.
3. Render state in webview.
4. Add slot lock toggle.
5. Add loot generation and equip logic.
6. Add encounters and combat.
7. Display greed bonus and lock debuff.
8. Add optional Git trigger.

## Risks and Questions

- Placeholder assets available but final icon pack is not yet provided.
- Git integration may be delayed if API or multi-repo complexity appears.
- Save scoping may remain global for MVP.
- Balance and weights need tuning after first playable version.
- Number of enemies and templates should stay small for MVP.

## Next Step

After saving this plan, implement the MVP according to the structure above and use `assets/placeholder.png` where specific icons are needed.
