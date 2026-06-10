import * as vscode from 'vscode';
import { GameState, EquipmentSlot, Rarity } from '../game/types';

function toTitle(value: string) {
  return value.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, (match) => match.toUpperCase());
}

function getRarityClass(rarity: Rarity): string {
  return `rarity-${rarity}`;
}

function renderStatList(stats: Record<string, number>) {
  return Object.entries(stats)
    .map(([key, value]) => `<div class="stat"><span>${toTitle(key)}</span><span>+${value}</span></div>`)
    .join('');
}

function renderSlotCard(slot: EquipmentSlot, iconBaseUri: vscode.Uri) {
  const item = slot.item;
  const itemIcon = item ? `${iconBaseUri.toString()}` : '';
  const itemName = item ? item.name : 'Empty';
  const rarityClass = item ? getRarityClass(item.rarity) : 'empty-slot';
  const itemDetails = item
    ? `<div class="slot-meta"> <span class="rarity">${item.rarity}</span> <span>ilvl ${item.itemLevel}</span> </div> <div class="slot-stats">${renderStatList(item.stats)}</div>`
    : '<div class="slot-meta empty">No item equipped</div>';

  return `
    <div class="slot-card ${rarityClass}">
      <div class="slot-header">
        <div>${toTitle(slot.slot)}</div>
        <button class="lock-button" data-slot="${slot.slot}">${slot.locked ? '🔒' : '🔓'}</button>
      </div>
      <div class="item-icon">
        <img src="${itemIcon}" alt="${itemName}" />
      </div>
      <div class="item-name">${itemName}</div>
      ${itemDetails}
    </div>
  `;
}

export function getWebviewContent(extensionUri: vscode.Uri, webview: vscode.Webview, state: GameState): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'styles', 'webview.css'));
  const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'placeholder.png'));

  const slotsHtml = Object.values(state.player.equipment)
    .map((slot) => renderSlotCard(slot, iconUri))
    .join('');

  const unlockedSlots = Object.values(state.player.equipment).filter((slot) => !slot.locked).length;
  const lockedSlots = Object.values(state.player.equipment).filter((slot) => slot.locked).length;
  const greedBonus = Math.min(0.95, unlockedSlots * 0.02);
  const lockDebuff = Math.min(0.75, lockedSlots * 0.01);
  const xpForNext = 50 + state.player.level * state.player.level * 25;

  const logHtml = state.log
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
    <header class="hero">
      <div>
        <h1>Merge & Magic</h1>
        <p>Level ${state.player.level} · XP ${state.player.xp}/${xpForNext} · Gold ${state.player.gold}</p>
      </div>
      <div class="controls">
        <button class="action-button" data-action="triggerEncounter">Trigger Encounter</button>
        <button class="action-button" data-action="dropTestLoot">Drop Test Loot</button>
        <button class="action-button" data-action="resetSave">Reset Save</button>
      </div>
    </header>

    <section class="status-panel">
      <div class="status-card">
        <div>Greed Bonus</div>
        <div class="status-value">+${(greedBonus * 100).toFixed(0)}%</div>
      </div>
      <div class="status-card">
        <div>Lock Debuff</div>
        <div class="status-value">-${(lockDebuff * 100).toFixed(0)}%</div>
      </div>
      <div class="status-card">
        <div>Unlocked Slots</div>
        <div class="status-value">${unlockedSlots}</div>
      </div>
      <div class="status-card">
        <div>Locked Slots</div>
        <div class="status-value">${lockedSlots}</div>
      </div>
    </section>

    <section class="equipment-grid">${slotsHtml}</section>

    <section class="log-panel">
      <h2>Activity Log</h2>
      <div class="log-list">${logHtml}</div>
    </section>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.lock-button').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'toggleSlotLock', slot: button.dataset.slot });
      });
    });

    document.querySelectorAll('.action-button').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: button.dataset.action });
      });
    });
  </script>
</body>
</html>`;
}
