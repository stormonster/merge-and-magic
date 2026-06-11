import * as vscode from 'vscode';
import { GameState, EquipmentSlot, EquipmentSlotType, Rarity } from '../game/types';

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

function renderSlotButton(slot: EquipmentSlot, iconUri: vscode.Uri) {
  const item = slot.item;
  const rarityClass = item ? getRarityClass(item.rarity) : 'empty-slot';
  const slotName = getSlotLabel(slot.slot);
  const itemName = item ? item.name : 'Empty';
  const detail = item ? `ilvl ${item.itemLevel}` : 'Empty';
  const tooltip = `${itemName}`;

  return `
    <button class="equip-slot ${rarityClass}" data-slot="${slot.slot}">
      <div class="slot-art">
        <img src="${iconUri.toString()}" alt="${itemName}" />
        <div class="slot-overlay">
          <div class="overlay-title">${slotName}</div>
          <div class="overlay-meta">
            <span>${detail}</span>
            <span class="lock-state">${slot.locked ? '🔒' : '🔓'}</span>
          </div>
        </div>
      </div>
      <div class="custom-tooltip">${tooltip}</div>
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
      <div class="brand-block" style="background-image: url('${logoUri.toString()}')">
      </div>
      <div class="stats-grid">
        <div class="stat-pill">
          <div class="stat-label">Level</div>
          <div class="stat-value">${state.player.level}</div>
        </div>
        <div class="stat-pill">
          <div class="stat-label">Power</div>
          <div class="stat-value">${powerScore}</div>
        </div>
        <div class="stat-pill">
          <div class="stat-label">Greed</div>
          <div class="stat-value">+${Math.round(greedBonus * 100)}%</div>
        </div>
      </div>
    </section>

    <section class="equipment-grid">
      ${equipmentButtons.join('')}
    </section>

    <section class="log-panel">
      <div class="log-title">Recent Activity</div>
      <div class="log-list">${logHtml}</div>
    </section>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.querySelectorAll('.equip-slot').forEach((button) => {
      button.addEventListener('click', () => {
        const slot = button.dataset.slot;
        vscode.postMessage({ type: 'toggleSlotLock', slot });
      });
    });
  </script>
</body>
</html>`;
}
