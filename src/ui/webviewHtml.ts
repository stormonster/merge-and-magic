import * as vscode from 'vscode';
import { GameLogEntry, GameState, EquipmentSlot, EquipmentSlotType, Rarity } from '../game/types';
import { xpRequiredForNextLevel } from '../game/progression';

const FOCUS_TARGET_MS = 5 * 60 * 1000;
const COMMIT_ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000;
const TOWN_ENTRY_COOLDOWN_MS = 5 * 60 * 1000;
const SUFFIX_OPTIONS = [
  'the Honorable',
  'the Bold',
  'the Wanderer',
  'the Unbroken',
  'the Lucky',
  'the Reckless',
  'the Relentless',
  'the Arcane',
  'the Unhinged',
  'the Caffeinated',
  'the Debugger',
  'the Uncommitted',
  'the Stalwart',
  'the Wayfarer',
  'the Watchful',
  'the Untamed',
  'the Resolute',
  'the Nomad',
  'the Keen',
  'the Persistent'
];

const slotLabels: Record<EquipmentSlotType, string> = {
  helmet: 'Helmet',
  chest: 'Chest',
  gloves: 'Gloves',
  boots: 'Boots',
  weapon: 'Weapon',
  offhand: 'Shield',
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

function formatHeroDisplayName(name: string, suffix: string): string {
  return [name.trim(), suffix.trim()].filter(Boolean).join(' ');
}

function renderSuffixOptions(selectedSuffix: string): string {
  return [
    '<option value="">Choose a suffix</option>',
    ...SUFFIX_OPTIONS.map((suffix) => {
      const selected = suffix === selectedSuffix ? ' selected' : '';
      return `<option value="${escapeHtml(suffix)}"${selected}>${escapeHtml(suffix)}</option>`;
    })
  ].join('');
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

function formatMinuteTarget(ms: number): string {
  return `${Math.max(1, Math.round(ms / 60000))}m`;
}

function formatGold(value: number): string {
  return value.toLocaleString('en-US');
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderHighlightedMessage(entry: GameLogEntry): string {
  const highlights = entry.highlights || [];
  if (highlights.length === 0) {
    return escapeHtml(entry.message);
  }

  const ranges = highlights
    .map((highlight) => {
      const start = entry.message.indexOf(highlight.text);
      return start >= 0
        ? {
            start,
            end: start + highlight.text.length,
            highlight
          }
        : null;
    })
    .filter((range): range is NonNullable<typeof range> => range !== null)
    .sort((left, right) => left.start - right.start);

  let cursor = 0;
  let html = '';
  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }

    html += escapeHtml(entry.message.slice(cursor, range.start));
    html += `<span class="log-item log-rarity-${range.highlight.rarity}">${escapeHtml(entry.message.slice(range.start, range.end))}</span>`;
    cursor = range.end;
  }

  html += escapeHtml(entry.message.slice(cursor));
  return html;
}

function renderLogEntry(entry: GameLogEntry): string {
  return `<div class="log-entry log-${entry.type}"><span>${renderHighlightedMessage(entry)}</span></div>`;
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
    <div class="tooltip-line">Slot: ${slotName}</div>
    <div class="tooltip-line">Item level: ${item.itemLevel}</div>
    ${statText ? `<div class="tooltip-line">${statText}</div>` : ''}
  `;
}

function renderSlotButton(slot: EquipmentSlot, iconUri: vscode.Uri | null) {
  const item = slot.item;
  const rarityClass = item ? getRarityClass(item.rarity) : 'empty-slot';
  const slotName = getSlotLabel(slot.slot);
  const itemName = item ? item.name : 'Empty';
  const tooltip = renderTooltip(slot, slotName);
  const iconHtml = iconUri ? `<img src="${iconUri.toString()}" alt="${itemName}" />` : '';

  return `
    <button class="equip-slot ${rarityClass}" data-slot="${slot.slot}">
      <div class="slot-art">
        ${iconHtml}
        <div class="slot-overlay">
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
  const assetBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets'));
  const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'placeholder.png'));
  const settingsIconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'settings-icon.png'));
  const backgroundUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', 'panel-background.png'));
  const heroName = state.player.name.trim();
  const heroSuffix = state.player.suffix.trim();
  const hasHeroIdentity = heroName.length > 0 && heroSuffix.length > 0;
  const heroDisplayName = hasHeroIdentity ? formatHeroDisplayName(heroName, heroSuffix) : 'Unnamed Adventurer';
  const nameFormReady = heroName.length > 0 && heroSuffix.length > 0;

  const slots = [
    state.player.equipment.amulet,
    state.player.equipment.helmet,
    state.player.equipment.gloves,
    state.player.equipment.weapon,
    state.player.equipment.chest,
    state.player.equipment.offhand,
    state.player.equipment.ring1,
    state.player.equipment.boots,
    state.player.equipment.ring2
  ];

  const getIconUri = (slot: EquipmentSlot) => {
    if (!slot.item) {
      return null;
    }

    const iconPath = slot.item.icon;
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'assets', ...iconPath.split('/')));
  };
  const equipmentButtons = slots.map((slot) => renderSlotButton(slot, getIconUri(slot)));
  const greedBonus = Math.min(0.95, Object.values(state.player.equipment).filter((slot) => !slot.locked).length * 0.02);
  const powerScore = computePowerScore(state);
  const xpRequired = xpRequiredForNextLevel(state.player.level);
  const xpPercent = clampPercent((state.player.xp / xpRequired) * 100);
  const hpPercent = clampPercent((state.player.hp / state.player.maxHp) * 100);
  const focusPercent = clampPercent((state.focus.activeMs / FOCUS_TARGET_MS) * 100);
  const focusMs = Math.min(state.focus.activeMs, FOCUS_TARGET_MS);
  const focusTargetLabel = formatMinuteTarget(FOCUS_TARGET_MS);
  const lastEncounterAt = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
  const commitCooldownMs = Math.max(0, COMMIT_ENCOUNTER_COOLDOWN_MS - (Date.now() - lastEncounterAt));
  const commitCooldownLabel = commitCooldownMs > 0 ? formatDuration(commitCooldownMs) : 'Ready';
  const lastTownEnteredAt = state.cooldowns.lastTownEnteredAt ? Date.parse(state.cooldowns.lastTownEnteredAt) : 0;
  const townCooldownMs = state.town.inTown ? 0 : Math.max(0, TOWN_ENTRY_COOLDOWN_MS - (Date.now() - lastTownEnteredAt));
  const townButtonLabel = state.town.inTown ? 'Leave town' : townCooldownMs > 0 ? `Town ${formatDuration(townCooldownMs)}` : 'Go to town';
  const townStatusLabel = state.town.inTown ? `Shopping · ${state.town.purchases} bought · HP ${state.player.hp}/${state.player.maxHp}` : townCooldownMs > 0 ? 'Restocking' : 'Adventure';
  const townButtonDisabled = !state.town.inTown && townCooldownMs > 0;
  const serializedState = JSON.stringify(state).replace(/</g, '\\u003c');

  const logHtml = state.log.slice(0, 10)
    .map(renderLogEntry)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Merge & Magic</title>
</head>
<body class="${hasHeroIdentity ? 'has-hero-name' : 'needs-hero-name'}" style="--panel-background-image: url('${backgroundUri.toString()}')">
  <button class="settings-fab" type="button" data-action="open-settings" aria-label="Open settings"${hasHeroIdentity ? '' : ' hidden'}>
    <img src="${settingsIconUri.toString()}" alt="" aria-hidden="true" />
  </button>

  <div class="settings-backdrop" data-action="close-settings" hidden></div>
  <aside class="settings-drawer" aria-hidden="true" hidden>
    <div class="drawer-header">
      <div class="drawer-title">Settings</div>
      <button class="drawer-close" type="button" data-action="close-settings" aria-label="Close settings">✕</button>
    </div>
    <form class="settings-form" data-form="name" autocomplete="off">
      <label class="field-label" for="settings-player-name">Hero name</label>
      <textarea class="name-input" id="settings-player-name" data-player-name-input rows="1" wrap="off" maxlength="24" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">${escapeHtml(heroName)}</textarea>
      <label class="field-label" for="settings-player-suffix">Hero suffix</label>
      <select class="name-input suffix-select" id="settings-player-suffix" data-player-suffix-select autocomplete="off">
        ${renderSuffixOptions(heroSuffix)}
      </select>
      <div class="settings-actions">
        <button class="settings-cancel" type="button" data-action="close-settings">Cancel</button>
        <button class="settings-save" type="submit"${nameFormReady ? '' : ' disabled'}>Save</button>
      </div>
    </form>
  </aside>

  <section class="onboarding-screen"${hasHeroIdentity ? ' hidden' : ''} data-onboarding-screen>
    <div class="onboarding-panel">
      <div class="onboarding-mark">
        <div class="brand-logo onboarding-logo" style="background-image: url('${logoUri.toString()}')"></div>
      </div>
      <div class="onboarding-copy">
        <div class="onboarding-kicker">Merge & Magic</div>
        <h1 class="onboarding-title">Name your hero</h1>
        <p class="onboarding-text">Choose a name and suffix before the journey begins.</p>
      </div>
      <form class="onboarding-form" data-form="name" autocomplete="off">
        <label class="field-label" for="onboarding-player-name">Hero name</label>
        <textarea class="name-input" id="onboarding-player-name" data-player-name-input rows="1" wrap="off" maxlength="24" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">${escapeHtml(heroName)}</textarea>
        <label class="field-label" for="onboarding-player-suffix">Hero suffix</label>
        <select class="name-input suffix-select" id="onboarding-player-suffix" data-player-suffix-select autocomplete="off">
          ${renderSuffixOptions(heroSuffix)}
        </select>
        <button class="onboarding-submit" type="submit" disabled>Begin adventure</button>
      </form>
    </div>
  </section>

  <div class="page">
    <section class="top-panel">
      <div class="brand-block">
        <div class="brand-logo" style="background-image: url('${logoUri.toString()}')"></div>
        <div class="gold-balance" aria-label="Gold amount">
          <div class="gold-label">Gold</div>
          <div class="gold-value" data-top-stat="gold">${formatGold(state.player.gold)}</div>
        </div>
      </div>
      <div class="hero-banner">
        <div class="hero-label">Hero</div>
        <div class="hero-value" data-hero-name>${escapeHtml(heroDisplayName)}</div>
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
        <div class="status-value" data-status="focus">${formatDuration(focusMs)}/${focusTargetLabel}</div>
        <div class="status-bar"><div class="status-fill focus-fill" data-status-fill="focus" style="width: ${focusPercent}%"></div></div>
      </div>
      <div class="status-row compact-status">
        <div class="status-label">Commit</div>
        <div class="status-value" data-status="commit">${commitCooldownLabel}</div>
      </div>
    </section>

    <section class="town-panel">
      <button class="town-button" data-action="town-toggle"${townButtonDisabled ? ' disabled' : ''}>${townButtonLabel}</button>
      <div class="town-status" data-town-status>${townStatusLabel}</div>
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
    const TOWN_ENTRY_COOLDOWN_MS = ${TOWN_ENTRY_COOLDOWN_MS};
    const ASSET_BASE_URI = '${assetBaseUri.toString()}';
    const SLOT_ORDER = ['amulet', 'helmet', 'gloves', 'weapon', 'chest', 'offhand', 'ring1', 'boots', 'ring2'];
    const SLOT_LABELS = ${JSON.stringify(slotLabels)};
    let currentState = ${serializedState};
    let lastTopStatsKey = '';
    let lastEquipmentKey = '';
    let lastLogKey = '';
    let settingsOpen = false;

    function notifyViewActive() {
      vscode.postMessage({ type: 'viewActive' });
    }

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

    function formatMinuteTarget(ms) {
      return Math.max(1, Math.round(ms / 60000)) + 'm';
    }

    function formatGold(value) {
      return Number(value || 0).toLocaleString('en-US');
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

    function getHeroName() {
      return (currentState.player.name || '').trim();
    }

    function getHeroSuffix() {
      return (currentState.player.suffix || '').trim();
    }

    function getHeroDisplayName() {
      const heroName = getHeroName();
      const heroSuffix = getHeroSuffix();
      return heroName && heroSuffix ? heroName + ' ' + heroSuffix : 'Unnamed Adventurer';
    }

    function normalizeHeroName(value) {
      return String(value || '').trim().replace(/\\s+/g, ' ').slice(0, 24);
    }

    function syncSettingsInputs(name, suffix) {
      document.querySelectorAll('[data-player-name-input]').forEach((field) => {
        if (field instanceof HTMLTextAreaElement) {
          field.value = name;
        }
      });

      document.querySelectorAll('[data-player-suffix-select]').forEach((field) => {
        if (field instanceof HTMLSelectElement) {
          field.value = suffix;
        }
      });
    }

    function updateNameFormButtons() {
      document.querySelectorAll('form[data-form="name"]').forEach((form) => {
        const nameInput = form.querySelector('[data-player-name-input]');
        const suffixInput = form.querySelector('[data-player-suffix-select]');
        const submitButton = form.querySelector('button[type="submit"]');

        if (!submitButton) {
          return;
        }

        const hasName = nameInput instanceof HTMLTextAreaElement ? normalizeHeroName(nameInput.value).length > 0 : false;
        const hasSuffix = suffixInput instanceof HTMLSelectElement ? String(suffixInput.value || '').trim().length > 0 : false;
        submitButton.disabled = !(hasName && hasSuffix);
      });
    }

    function updateIdentity(force) {
      const heroName = getHeroName();
      const heroSuffix = getHeroSuffix();
      const hasHeroIdentity = heroName.length > 0 && heroSuffix.length > 0;
      const title = getHeroDisplayName();
      const onboarding = document.querySelector('[data-onboarding-screen]');
      const settingsButton = document.querySelector('[data-action="open-settings"]');
      const settingsDrawer = document.querySelector('.settings-drawer');
      const settingsBackdrop = document.querySelector('.settings-backdrop');

      document.body.classList.toggle('needs-hero-name', !hasHeroIdentity);
      document.body.classList.toggle('has-hero-name', hasHeroIdentity);
      document.body.classList.toggle('settings-open', settingsOpen);

      setText('[data-hero-name]', title);

      if (onboarding) {
        onboarding.hidden = hasHeroIdentity;
        onboarding.style.display = hasHeroIdentity ? 'none' : 'grid';
      }

      if (settingsButton) {
        settingsButton.hidden = !hasHeroIdentity;
        settingsButton.style.display = hasHeroIdentity ? 'inline-flex' : 'none';
      }

      if (settingsDrawer) {
        settingsDrawer.hidden = !settingsOpen;
        settingsDrawer.setAttribute('aria-hidden', settingsOpen ? 'false' : 'true');
        settingsDrawer.style.display = settingsOpen ? 'block' : 'none';
      }

      if (settingsBackdrop) {
        settingsBackdrop.hidden = !settingsOpen;
        settingsBackdrop.style.display = settingsOpen ? 'block' : 'none';
      }

      updateNameFormButtons();
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
        '<div class="tooltip-line">Slot: ' + escapeHtml(slotName) + '</div>',
        '<div class="tooltip-line">Item level: ' + item.itemLevel + '</div>',
        statText ? '<div class="tooltip-line">' + escapeHtml(statText) + '</div>' : ''
      ].join('');
    }

    function renderTopStats(force) {
      const state = currentState;
      const powerScore = computePowerScore(state);
      const greedBonus = getGreedBonus(state);
      const key = [state.player.level, powerScore, state.player.hp, state.player.maxHp, greedBonus, state.player.gold].join(':');
      if (!force && key === lastTopStatsKey) {
        return;
      }

      lastTopStatsKey = key;
      setText('[data-top-stat="level"]', state.player.level);
      setText('[data-top-stat="power"]', powerScore);
      setText('[data-top-stat="hp"]', state.player.hp + '/' + state.player.maxHp);
      setText('[data-top-stat="greed"]', '+' + Math.round(greedBonus * 100) + '%');
      setText('[data-top-stat="gold"]', formatGold(state.player.gold));
    }

    function updateStatus() {
      const state = currentState;
      const xpRequired = xpRequiredForNextLevel(state.player.level);
      const focusMs = Math.min(state.focus.activeMs, FOCUS_TARGET_MS);
      const focusTargetLabel = formatMinuteTarget(FOCUS_TARGET_MS);
      const lastEncounterAt = state.cooldowns.lastEncounterAt ? Date.parse(state.cooldowns.lastEncounterAt) : 0;
      const commitCooldownMs = Math.max(0, COMMIT_ENCOUNTER_COOLDOWN_MS - (Date.now() - lastEncounterAt));
      const lastTownEnteredAt = state.cooldowns.lastTownEnteredAt ? Date.parse(state.cooldowns.lastTownEnteredAt) : 0;
      const townCooldownMs = state.town.inTown ? 0 : Math.max(0, TOWN_ENTRY_COOLDOWN_MS - (Date.now() - lastTownEnteredAt));
      const townButton = document.querySelector('[data-action="town-toggle"]');

      setText('[data-status="hp"]', state.player.hp + '/' + state.player.maxHp);
      setWidth('[data-status-fill="hp"]', (state.player.hp / state.player.maxHp) * 100);
      setText('[data-status="xp"]', state.player.xp + '/' + xpRequired);
      setWidth('[data-status-fill="xp"]', (state.player.xp / xpRequired) * 100);
      setText('[data-status="focus"]', formatDuration(focusMs) + '/' + focusTargetLabel);
      setWidth('[data-status-fill="focus"]', (state.focus.activeMs / FOCUS_TARGET_MS) * 100);
      setText('[data-status="commit"]', commitCooldownMs > 0 ? formatDuration(commitCooldownMs) : 'Ready');
      setText('[data-town-status]', state.town.inTown ? 'Shopping · ' + state.town.purchases + ' bought · HP ' + state.player.hp + '/' + state.player.maxHp : townCooldownMs > 0 ? 'Restocking' : 'Adventure');
      setText('[data-action="town-toggle"]', state.town.inTown ? 'Leave town' : townCooldownMs > 0 ? 'Town ' + formatDuration(townCooldownMs) : 'Go to town');
      if (townButton) {
        townButton.disabled = !state.town.inTown && townCooldownMs > 0;
      }
    }

    function renderSlotButton(slot) {
      const item = slot.item;
      const rarityClass = item ? 'rarity-' + item.rarity : 'empty-slot';
      const slotName = getSlotLabel(slot.slot);
      const itemName = item ? item.name : 'Empty';
      const tooltip = renderTooltip(slot, slotName);
      const iconHtml = item ? '<img src="' + ASSET_BASE_URI + '/' + item.icon.split('/').map(encodeURIComponent).join('/') + '" alt="' + escapeHtml(itemName) + '" />' : '';
      return [
        '<button class="equip-slot ' + rarityClass + '" data-slot="' + escapeHtml(slot.slot) + '">',
        '<div class="slot-art">',
        iconHtml,
        '<div class="slot-overlay">',
        '<div class="overlay-meta">',
        '<span class="lock-state">' + (slot.locked ? '🔒' : '🔓') + '</span>',
        '</div>',
        '</div>',
        '</div>',
        '<div class="custom-tooltip tooltip-' + rarityClass + '">' + tooltip + '</div>',
        '</button>'
      ].join('');
    }

    function renderHighlightedMessage(entry) {
      const highlights = entry.highlights || [];
      if (highlights.length === 0) {
        return escapeHtml(entry.message);
      }

      const ranges = highlights
        .map((highlight) => {
          const start = entry.message.indexOf(highlight.text);
          return start >= 0
            ? {
                start,
                end: start + highlight.text.length,
                highlight
              }
            : null;
        })
        .filter(Boolean)
        .sort((left, right) => left.start - right.start);

      let cursor = 0;
      let html = '';
      ranges.forEach((range) => {
        if (range.start < cursor) {
          return;
        }

        html += escapeHtml(entry.message.slice(cursor, range.start));
        html += '<span class="log-item log-rarity-' + escapeHtml(range.highlight.rarity) + '">' + escapeHtml(entry.message.slice(range.start, range.end)) + '</span>';
        cursor = range.end;
      });

      html += escapeHtml(entry.message.slice(cursor));
      return html;
    }

    function renderLogEntry(entry) {
      return '<div class="log-entry log-' + escapeHtml(entry.type) + '"><span>' + renderHighlightedMessage(entry) + '</span></div>';
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
      const key = JSON.stringify(entries.map((entry) => [entry.id, entry.createdAt, entry.type, entry.message, entry.highlights]));
      if (!force && key === lastLogKey) {
        return;
      }

      lastLogKey = key;
      const container = document.querySelector('[data-section="log"]');
      if (!container) {
        return;
      }
      container.innerHTML = entries
        .map(renderLogEntry)
        .join('');
    }

    function renderState(force) {
      updateIdentity(force);
      renderTopStats(force);
      updateStatus();
      renderEquipment(force);
      renderLog(force);
    }

    function setSettingsOpen(open) {
      settingsOpen = open;
      if (open) {
        syncSettingsInputs(getHeroName(), getHeroSuffix());
      }
      updateIdentity(false);
      updateNameFormButtons();
    }

    document.querySelector('[data-action="open-settings"]')?.addEventListener('click', () => {
      setSettingsOpen(true);
    });

    document.querySelectorAll('[data-action="close-settings"]').forEach((button) => {
      button.addEventListener('click', () => {
        syncSettingsInputs(getHeroName(), getHeroSuffix());
        setSettingsOpen(false);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && settingsOpen) {
        syncSettingsInputs(getHeroName(), getHeroSuffix());
        setSettingsOpen(false);
      }
    });

    function saveSettings(form) {
      const nameInput = form.querySelector('[data-player-name-input]');
      const suffixInput = form.querySelector('[data-player-suffix-select]');
      const nextName = nameInput instanceof HTMLTextAreaElement ? normalizeHeroName(nameInput.value) : '';
      const nextSuffix = suffixInput instanceof HTMLSelectElement ? String(suffixInput.value || '').trim() : '';

      if (!nextName) {
        if (nameInput instanceof HTMLTextAreaElement) {
          nameInput.focus();
        }
        return;
      }

      if (!nextSuffix) {
        if (suffixInput instanceof HTMLSelectElement) {
          suffixInput.focus();
        }
        return;
      }

      syncSettingsInputs(nextName, nextSuffix);
      currentState.player.name = nextName;
      currentState.player.suffix = nextSuffix;
      renderState(true);
      vscode.postMessage({ type: 'saveSettings', name: nextName, suffix: nextSuffix });
      setSettingsOpen(false);
    }

    document.querySelectorAll('form[data-form="name"]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveSettings(form);
      });
    });

    document.querySelectorAll('[data-player-name-input], [data-player-suffix-select]').forEach((input) => {
      if (input instanceof HTMLTextAreaElement) {
        input.addEventListener('input', updateNameFormButtons);
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' || event.shiftKey) {
            return;
          }

          event.preventDefault();
          const form = input.closest('form[data-form="name"]');
          if (form) {
            form.requestSubmit();
          }
        });
        return;
      }

      if (input instanceof HTMLSelectElement) {
        input.addEventListener('change', updateNameFormButtons);
      }
    });

    updateNameFormButtons();

    document.querySelector('[data-action="town-toggle"]')?.addEventListener('click', () => {
      if (!currentState.town.inTown) {
        const lastTownEnteredAt = currentState.cooldowns.lastTownEnteredAt ? Date.parse(currentState.cooldowns.lastTownEnteredAt) : 0;
        const townCooldownMs = Math.max(0, TOWN_ENTRY_COOLDOWN_MS - (Date.now() - lastTownEnteredAt));
        if (townCooldownMs > 0) {
          return;
        }
      }
      vscode.postMessage({ type: currentState.town.inTown ? 'leaveTown' : 'enterTown' });
    });

    document.addEventListener('visibilitychange', () => {
      vscode.postMessage({ type: document.hidden ? 'viewHidden' : 'viewActive' });
    });
    window.addEventListener('focus', notifyViewActive);
    window.addEventListener('pageshow', notifyViewActive);
    document.addEventListener('pointerdown', notifyViewActive);

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || message.type !== 'stateUpdate') {
        return;
      }
      currentState = message.state;
      renderState(false);
    });

    renderState(true);
    notifyViewActive();
    setInterval(updateStatus, 1000);
  </script>
</body>
</html>`;
}
