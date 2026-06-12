import * as vscode from 'vscode';
import { GameState, EquipmentSlot, EquipmentSlotType, Rarity } from '../game/types';
import { xpRequiredForNextLevel } from '../game/progression';

const FOCUS_TARGET_MS = 60 * 1000;
const COMMIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;

const slotLabels: Record<EquipmentSlotType, string> = {
  helmet: 'Helmet',
  chest: 'Chest',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapon',
  offhand: 'Offhand',
  amulet: 'Amulet',
  ring1: 'Ring',
  ring2: 'Ring'
};

function getRarityClass(rarity: Rarity): string {
  return `rarity-${rarity}`;
}

function getSlotLabel(slot: EquipmentSlotType) {
  return slotLabels[slot] || slot.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, (match) => match.toUpperCase());
}

function computePowerScore(state: GameState) {
  const baseStats = Object.values(state.player.baseStats).reduce((sum, value) => sum + value, 0);
  const equipStats = Object.values(state.player.equipment).reduce((sum, slot) => {
    if (!slot.item) return sum;
    return sum + Object.values(slot.item.stats).reduce((inner, value) => inner + (value || 0), 0);
  }, 0);
  return Math.max(1, Math.floor(baseStats + equipStats + state.player.level * 4));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function formatItemStats(item: EquipmentSlot['item']): string {
  if (!item) {
    return '';
  }

  return Object.entries(item.stats)
    .filter(([, value]) => typeof value === 'number')
    .map(([stat, value]) => `+${value} ${stat}`)
    .join(', ');
}

function renderTooltip(slot: EquipmentSlot, slotName: string): string {
  const item = slot.item;
  if (!item) {
    return `
      <div class="tooltip-title">${slotName}</div>
      <div class="tooltip-line">Empty slot</div>
    `;
  }

  const statText = formatItemStats(item);
  return `
    <div class="tooltip-title">${item.name}</div>
    <div class="tooltip-line">${slotName} · ilvl ${item.itemLevel}</div>
    ${statText ? `<div class="tooltip-line">${statText}</div>` : ''}
  `;
}

function renderSlotButton(slot: EquipmentSlot, iconUri: vscode.Uri) {
  const item = slot.item;
  const rarityClass = item ? getRarityClass(item.rarity) : 'empty-slot';
  const slotName = getSlotLabel(slot.slot);
  const itemName = item ? item.name : 'Empty';
  const tooltip = renderTooltip(slot, slotName);

  return `
    <button class="equip-slot ${rarityClass}" data-slot="${slot.slot}">
      <div class="slot-art">
        <img src="${iconUri.toString()}" alt="${itemName}" />
        <div class="slot-overlay">
          <div class="overlay-title">${slotName}</div>
          <div class="overlay-meta">
            <span class="lock-state">${slot.locked ? '🔒' : '🔓'}</span>
          </div>
        </div>
      </div>
      <div class="custom-tooltip tooltip-${rarityClass}">${tooltip}</div>
    </button>
  `;
}

export function getWebviewContent(extensionUri: vscode.Uri, webview: vscode.Webview, state: GameState): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'webview.css'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'placeholder.png'));
  const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'placeholder.png'));

  const slots = [
    state.player.equipment.helmet,
    state.player.equipment.chest,
    state.player.equipment.weapon,
    state.player.equipment.offhand,
    state.player.equipment.boots,
    state.player.equipment.gloves,
    state.player.equipment.ring1,
    state.player.equipment.ring2,
    state.player.equipment.amulet
  ];

  const equipmentButtons = slots.map((slot) => renderSlotButton(slot, iconUri));
  const greedBonus = Math.min(0.95, Object.values(state.player.equipment).filter((slot) => !slot.locked).length * 0.02);
  const powerScore = computePowerScore(state);
  const xpRequired = xpRequiredForNextLevel(state.player.level);
  const xpPercent = clampPercent((state.player.xp / xpRequired) * 100);
  const hpPercent = clampPercent((state.player.hp / state.player.maxHp) * 100);
  const focusPercent = clampPercent((state.focus.activeMs / FOCUS_TARGET_MS) * 100);
  const focusSeconds = Math.min(Math.floor(state.focus.activeMs / 1000), Math.floor(FOCUS_TARGET_MS / 1000));
  const lastEncounterAt = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
  const commitCooldownMs = Math.max(0, COMMIT_ENCOUNTER_COOLDOWN_MS - (Date.now() - lastEncounterAt));
  const commitCooldownLabel = commitCooldownMs > 0 ? formatDuration(commitCooldownMs) : 'Ready';
  const serializedState = JSON.stringify(state).replace(/</g, '\\u003c');

  const logHtml = state.log.slice(0, 10)
    .map((entry) => `<div class="log-entry log-${entry.type}"><span>${entry.message}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Merge & Magic</title>
</head>
<body>
  <div class="page">
    <section class="top-panel">
        <div class="brand-block">
      <div class="brand-logo" style="background-image: url('${logoUri.toString()}')">
      </div>
      </div>
      <div class="stats-grid">
        <div class="stat-pill">
          <div class="stat-label">Level</div>
          <div class="stat-value" data-top-stat="level">${state.player.level}</div>
        </div>
        <div class="stat-pill">
          <div class="stat-label">Power</div>
          <div class="stat-value" data-top-stat="power">${powerScore}</div>
        </div>
        <div class="stat-pill">
          <div class="stat-label">HP</div>
          <div class="stat-value" data-top-stat="hp">${state.player.hp}/${state.player.maxHp}</div>
        </div>
        <div class="stat-pill">
          <div class="stat-label">Greed</div>
          <div class="stat-value" data-top-stat="greed">+${Math.round(greedBonus * 100)}%</div>
        </div>
      </div>
    </section>

    <section class="status-strip">
      <div class="status-row">
        <div class="status-label">HP</div>
        <div class="status-value" data-status="hp">${state.player.hp}/${state.player.maxHp}</div>
        <div class="status-bar"><div class="status-fill hp-fill" data-status-fill="hp" style="width: ${hpPercent}%"></div></div>
      </div>
      <div class="status-row">
        <div class="status-label">XP</div>
        <div class="status-value" data-status="xp">${state.player.xp}/${xpRequired}</div>
        <div class="status-bar"><div class="status-fill xp-fill" data-status-fill="xp" style="width: ${xpPercent}%"></div></div>
      </div>
      <div class="status-row">
        <div class="status-label">Focus</div>
        <div class="status-value" data-status="focus">${focusSeconds}/60s</div>
        <div class="status-bar"><div class="status-fill focus-fill" data-status-fill="focus" style="width: ${focusPercent}%"></div></div>
      </div>
      <div class="status-row compact-status">
        <div class="status-label">Commit</div>
        <div class="status-value" data-status="commit">${commitCooldownLabel}</div>
      </div>
    </section>

    <section class="equipment-grid" data-section="equipment">
      ${equipmentButtons.join('')}
    </section>

    <section class="log-panel">
      <div class="log-title">Recent Activity</div>
      <div class="log-list" data-section="log">${logHtml}</div>
    </section>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const FOCUS_TARGET_MS = ${FOCUS_TARGET_MS};
    const COMMIT_ENCOUNTER_COOLDOWN_MS = ${COMMIT_ENCOUNTER_COOLDOWN_MS};
    const ITEM_ICON_URI = '${iconUri.toString()}';
    const SLOT_ORDER = ['helmet', 'chest', 'weapon', 'offhand', 'boots', 'gloves', 'ring1', 'ring2', 'amulet'];
    const SLOT_LABELS = ${JSON.stringify(slotLabels)};
    let currentState = ${serializedState};
    let lastTopStatsKey = '';
    let lastEquipmentKey = '';
    let lastLogKey = '';

    function clampPercent(value) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }

    function formatDuration(ms) {
      const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      if (minutes <= 0) {
        return seconds + 's';
      }
      return minutes + 'm ' + seconds + 's';
    }

    function xpRequiredForNextLevel(level) {
      return 50 + level * level * 25;
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function setText(selector, value) {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = value;
      }
    }

    function setWidth(selector, percent) {
      const element = document.querySelector(selector);
      if (element) {
        element.style.width = clampPercent(percent) + '%';
      }
    }

    function computePowerScore(state) {
      const baseStats = Object.values(state.player.baseStats).reduce((sum, value) => sum + value, 0);
      const equipStats = Object.values(state.player.equipment).reduce((sum, slot) => {
        if (!slot.item) {
          return sum;
        }
        return sum + Object.values(slot.item.stats).reduce((inner, value) => inner + (value || 0), 0);
      }, 0);
      return Math.max(1, Math.floor(baseStats + equipStats + state.player.level * 4));
    }

    function getGreedBonus(state) {
      const unlockedSlots = Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
      return Math.min(0.95, unlockedSlots * 0.02);
    }

    function getSlotLabel(slot) {
      return SLOT_LABELS[slot] || slot;
    }

    function formatItemStats(item) {
      if (!item) {
        return '';
      }
      return Object.entries(item.stats)
        .filter((entry) => typeof entry[1] === 'number')
        .map((entry) => '+' + entry[1] + ' ' + entry[0])
        .join(', ');
    }

    function renderTooltip(slot, slotName) {
      const item = slot.item;
      if (!item) {
        return [
          '<div class="tooltip-title">' + escapeHtml(slotName) + '</div>',
          '<div class="tooltip-line">Empty slot</div>'
        ].join('');
      }

      const statText = formatItemStats(item);
      return [
        '<div class="tooltip-title">' + escapeHtml(item.name) + '</div>',
        '<div class="tooltip-line">' + escapeHtml(slotName) + ' · ilvl ' + item.itemLevel + '</div>',
        statText ? '<div class="tooltip-line">' + escapeHtml(statText) + '</div>' : ''
      ].join('');
    }

    function renderTopStats(force) {
      const state = currentState;
      const powerScore = computePowerScore(state);
      const greedBonus = getGreedBonus(state);
      const key = [state.player.level, powerScore, state.player.hp, state.player.maxHp, greedBonus].join(':');
      if (!force && key === lastTopStatsKey) {
        return;
      }

      lastTopStatsKey = key;
      setText('[data-top-stat="level"]', state.player.level);
      setText('[data-top-stat="power"]', powerScore);
      setText('[data-top-stat="hp"]', state.player.hp + '/' + state.player.maxHp);
      setText('[data-top-stat="greed"]', '+' + Math.round(greedBonus * 100) + '%');
    }

    function updateStatus() {
      const state = currentState;
      const xpRequired = xpRequiredForNextLevel(state.player.level);
      const focusSeconds = Math.min(Math.floor(state.focus.activeMs / 1000), Math.floor(FOCUS_TARGET_MS / 1000));
      const lastEncounterAt = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
      const commitCooldownMs = Math.max(0, COMMIT_ENCOUNTER_COOLDOWN_MS - (Date.now() - lastEncounterAt));

      setText('[data-status="hp"]', state.player.hp + '/' + state.player.maxHp);
      setWidth('[data-status-fill="hp"]', (state.player.hp / state.player.maxHp) * 100);
      setText('[data-status="xp"]', state.player.xp + '/' + xpRequired);
      setWidth('[data-status-fill="xp"]', (state.player.xp / xpRequired) * 100);
      setText('[data-status="focus"]', focusSeconds + '/60s');
      setWidth('[data-status-fill="focus"]', (state.focus.activeMs / FOCUS_TARGET_MS) * 100);
      setText('[data-status="commit"]', commitCooldownMs > 0 ? formatDuration(commitCooldownMs) : 'Ready');
    }

    function renderSlotButton(slot) {
      const item = slot.item;
      const rarityClass = item ? 'rarity-' + item.rarity : 'empty-slot';
      const slotName = getSlotLabel(slot.slot);
      const itemName = item ? item.name : 'Empty';
      const tooltip = renderTooltip(slot, slotName);
      return [
        '<button class="equip-slot ' + rarityClass + '" data-slot="' + escapeHtml(slot.slot) + '">',
        '<div class="slot-art">',
        '<img src="' + ITEM_ICON_URI + '" alt="' + escapeHtml(itemName) + '" />',
        '<div class="slot-overlay">',
        '<div class="overlay-title">' + escapeHtml(slotName) + '</div>',
        '<div class="overlay-meta">',
        '<span class="lock-state">' + (slot.locked ? '🔒' : '🔓') + '</span>',
        '</div>',
        '</div>',
        '</div>',
        '<div class="custom-tooltip tooltip-' + rarityClass + '">' + tooltip + '</div>',
        '</button>'
      ].join('');
    }

    function bindEquipmentButtons() {
      document.querySelectorAll('.equip-slot').forEach((button) => {
        button.addEventListener('click', () => {
          const slot = button.dataset.slot;
          vscode.postMessage({ type: 'toggleSlotLock', slot });
        });
      });
    }

    function renderEquipment(force) {
      const slots = SLOT_ORDER.map((slot) => currentState.player.equipment[slot]);
      const key = JSON.stringify(slots.map((slot) => ({
        slot: slot.slot,
        locked: slot.locked,
        itemId: slot.item ? slot.item.id : null
      })));
      if (!force && key === lastEquipmentKey) {
        return;
      }

      lastEquipmentKey = key;
      const container = document.querySelector('[data-section="equipment"]');
      if (!container) {
        return;
      }
      container.innerHTML = slots.map(renderSlotButton).join('');
      bindEquipmentButtons();
    }

    function renderLog(force) {
      const entries = currentState.log.slice(0, 10);
      const key = JSON.stringify(entries.map((entry) => [entry.id, entry.createdAt, entry.type, entry.message]));
      if (!force && key === lastLogKey) {
        return;
      }

      lastLogKey = key;
      const container = document.querySelector('[data-section="log"]');
      if (!container) {
        return;
      }
      container.innerHTML = entries
        .map((entry) => '<div class="log-entry log-' + escapeHtml(entry.type) + '"><span>' + escapeHtml(entry.message) + '</span></div>')
        .join('');
    }

    function renderState(force) {
      renderTopStats(force);
      updateStatus();
      renderEquipment(force);
      renderLog(force);
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'stateUpdate') {
        return;
      }
      currentState = message.state;
      renderState(false);
    });

    renderState(true);
    setInterval(updateStatus, 1000);
  </script>
</body>
</html>`;
}
