// ── State ───────────────────────────────────────────────────
let state = null;
let selectedAgentId = null;
let ws = null;
let game = null;
let mapScene = null;
const agentSprites = {};
const locationMarkers = {};

// ── Building style definitions ──────────────────────────────
const BLDG = {
  // Residential — each house is unique
  house_1:    { body: 0xFFCCBC, roof: 0xBF360C, trim: 0x8D6E63, accent: 0x4CAF50, label: "Chen",    roofStyle: "gable" },
  house_2:    { body: 0xBBDEFB, roof: 0x1565C0, trim: 0x78909C, accent: 0xFFC107, label: "Williams", roofStyle: "gable" },
  house_3:    { body: 0xC8E6C9, roof: 0x33691E, trim: 0x6D4C41, accent: 0xFF8F00, label: "Henderson", roofStyle: "hip" },
  house_4:    { body: 0xFFF9C4, roof: 0xF57F17, trim: 0xA1887F, accent: 0x26A69A, label: "Patel",    roofStyle: "gable" },
  house_5:    { body: 0xF8BBD0, roof: 0xAD1457, trim: 0x8D6E63, accent: 0xFFCA28, label: "Moreno",   roofStyle: "hip" },
  house_6:    { body: 0xD1C4E9, roof: 0x4527A0, trim: 0x78909C, accent: 0x66BB6A, label: "Fisher",   roofStyle: "gable" },
  apt_101:    { body: 0xB2DFDB, roof: 0x00695C, trim: 0x546E7A, accent: 0xFFCA28, label: "Apt 101",  roofStyle: "flat" },
  apt_102:    { body: 0xB2DFDB, roof: 0x00695C, trim: 0x546E7A, accent: 0x66BB6A, label: "Apt 102",  roofStyle: "flat" },
  // Commercial
  sunrise_cafe:    { body: 0xFFF8E1, roof: 0xE65100, trim: 0x795548, accent: 0xFF5722, label: "Sunrise Cafe",     roofStyle: "awning" },
  greenleaf_grocery:{ body: 0xE8F5E9, roof: 0x2E7D32, trim: 0x558B2F, accent: 0xFDD835, label: "Greenleaf Grocery", roofStyle: "flat" },
  birch_barrel:    { body: 0xEFEBE9, roof: 0x3E2723, trim: 0x5D4037, accent: 0xFF8F00, label: "Birch & Barrel",   roofStyle: "gable" },
  pages_bookstore: { body: 0xFCE4EC, roof: 0x880E4F, trim: 0x6D4C41, accent: 0xFFC107, label: "Pages Books",      roofStyle: "gable" },
  corner_pharmacy: { body: 0xE3F2FD, roof: 0x01579B, trim: 0x455A64, accent: 0x00E676, label: "Pharmacy",         roofStyle: "flat" },
  // Community
  school:           { body: 0xFFF3E0, roof: 0xBF360C, trim: 0x6D4C41, accent: 0x1565C0, label: "Maplewood Elementary", roofStyle: "hip", big: true },
  school_classroom_a:{ body: 0xFFE0B2, roof: 0xE65100, trim: 0x795548, accent: 0x4CAF50, label: "Classroom A",          roofStyle: "flat" },
  community_center: { body: 0xE8EAF6, roof: 0x283593, trim: 0x5C6BC0, accent: 0xFFCA28, label: "Community Center",     roofStyle: "flat", big: true },
  elm_park:        { body: 0x66BB6A, roof: 0x2E7D32, trim: 0x33691E, accent: 0x4FC3F7, label: "Elm Park",             roofStyle: "none", big: true },
  fire_station:    { body: 0xFFCDD2, roof: 0xB71C1C, trim: 0xD32F2F, accent: 0xFFFFFF, label: "Fire Station",         roofStyle: "flat" },
  // Workplaces
  town_hall:       { body: 0xECEFF1, roof: 0x37474F, trim: 0x546E7A, accent: 0x1565C0, label: "Town Hall",            roofStyle: "column", big: true },
  riverside_tech:  { body: 0xE1F5FE, roof: 0x0277BD, trim: 0x4FC3F7, accent: 0x00E676, label: "Riverside Tech",       roofStyle: "flat", big: true },
  medical_center:  { body: 0xF3E5F5, roof: 0x6A1B9A, trim: 0xAB47BC, accent: 0xFFFFFF, label: "Medical Center",       roofStyle: "flat", big: true },
  library:         { body: 0xFFF8E1, roof: 0x5D4037, trim: 0x795548, accent: 0xFFC107, label: "Public Library",       roofStyle: "gable", big: true },
};

// ── WebSocket ───────────────────────────────────────────────
function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);
  ws.onopen = () => {
    document.getElementById('loading').style.display = 'none';
    ws.send(JSON.stringify({ action: 'start' }));
  };
  ws.onmessage = (e) => {
    try {
      state = JSON.parse(e.data);
      lastWsUpdate = Date.now();
      updateUI();
    } catch (err) { console.error('Parse error:', err); }
  };
  ws.onclose = () => {
    document.getElementById('loading').style.display = 'flex';
    setTimeout(connectWS, 2000);
  };
  ws.onerror = () => {};
}

// ── UI Updates ──────────────────────────────────────────────
function updateUI() {
  if (!state) return;
  updateTimeBar();
  updateAgentList();
  updateEventLog();
  updateStats();
  if (selectedAgentId) updateDetailPanel();
  if (mapScene) mapScene.updateAgents();
}

function updateTimeBar() {
  document.getElementById('sim-time').textContent = state.sim_time_display || '';
  const w = state.weather || {};
  document.getElementById('weather').textContent = `${w.condition || ''} ${w.temperature_f || ''}\u00B0F`;
  document.getElementById('day-num').textContent = `Day ${state.day_number || 1}`;
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const spd = state.speed || 60;
  const mapping = { 0: 'btn-pause', 1: 'btn-1x', 10: 'btn-10x', 60: 'btn-60x', 120: 'btn-120x' };
  const btn = document.getElementById(mapping[spd]);
  if (btn) btn.classList.add('active');
}

function updateAgentList() {
  const list = document.getElementById('agent-list');
  const agents = state.agents || [];
  list.innerHTML = agents.map(a => {
    const moodColor = a.emotion.valence > 0.2 ? '#4CAF50' : a.emotion.valence < -0.2 ? '#E57373' : '#FFB74D';
    const activity = a.current_activity.replace(/_/g, ' ');
    const loc = (state.locations || {})[a.location_id];
    const locName = loc ? loc.name : a.location_id;
    const selected = a.id === selectedAgentId ? 'selected' : '';
    return `<div class="agent-card ${selected}" onclick="selectAgent('${a.id}')">
      <div class="mood-dot" style="background:${moodColor}"></div>
      <div class="agent-info">
        <div class="agent-name">${a.name}</div>
        <div class="agent-status">${locName}</div>
        <div class="agent-activity">${activity}</div>
      </div>
    </div>`;
  }).join('');
}

function updateEventLog() {
  const list = document.getElementById('log-list');
  const events = state.event_log || [];
  document.getElementById('log-count').textContent = `${events.length} events`;
  list.innerHTML = events.slice().reverse().map(e =>
    `<div class="event-item">
      <span class="ev-time">${e.time || ''}</span>
      <span class="ev-icon">${e.icon || '\u2022'}</span>
      <span class="ev-text">${e.text || ''}</span>
    </div>`
  ).join('');
}

function updateStats() {
  const s = state.stats || {};
  document.getElementById('stat-agents').textContent = `${(state.agents||[]).length} agents`;
  document.getElementById('stat-conversations').textContent = `${s.total_conversations||0} conversations`;
  document.getElementById('stat-actions').textContent = `${s.total_actions||0} actions`;
}

// ── Agent Detail Panel ──────────────────────────────────────
function selectAgent(agentId) {
  selectedAgentId = agentId;
  document.getElementById('detail-panel').classList.add('visible');
  updateDetailPanel();
  if (mapScene) mapScene.focusAgent(agentId);
}

function closeDetail() {
  selectedAgentId = null;
  document.getElementById('detail-panel').classList.remove('visible');
}

async function updateDetailPanel() {
  if (!selectedAgentId) return;
  try {
    const resp = await fetch(`/api/v1/agents/${selectedAgentId}`);
    const a = await resp.json();
    if (a.error) return;
    document.getElementById('detail-name').textContent = `${a.name}, ${a.age}`;
    const loc = (state.locations || {})[a.location_id];
    const locName = loc ? loc.name : a.location_id;
    let html = `<div class="detail-section"><h4>About</h4>
      <div class="bio">${a.occupation} \u00B7 ${a.life_stage || ''}</div>
      <div class="bio" style="margin-top:4px">${a.bio || ''}</div>
      <div class="bio" style="margin-top:4px;color:#4CAF50">${a.has_car ? '\uD83D\uDE97' : ''} ${a.has_bicycle ? '\uD83D\uDEB2' : ''} Currently at ${locName}</div></div>`;
    const n = a.needs || {};
    html += `<div class="detail-section"><h4>Needs</h4>`;
    for (const [key, val] of Object.entries(n)) {
      const color = val < 30 ? '#E57373' : val < 60 ? '#FFB74D' : '#81C784';
      html += `<div class="need-bar"><span class="label">${key}</span><div class="bar-bg"><div class="bar-fill" style="width:${val}%;background:${color}"></div></div><span class="value">${Math.round(val)}</span></div>`;
    }
    html += `</div>`;
    const emo = a.emotion || {};
    html += `<div class="detail-section"><h4>Mood</h4><div class="mood-display"><span class="mood-emoji">${emo.emoji || '\uD83D\uDE10'}</span><div><div class="mood-label">${emo.dominant || 'neutral'}</div><div class="mood-values">V: ${(emo.valence||0).toFixed(2)} \u00B7 A: ${(emo.arousal||0).toFixed(2)}</div></div></div></div>`;
    const fin = a.financial || {};
    html += `<div class="detail-section"><h4>Financial</h4><div class="financial-grid"><div class="financial-item"><div class="fin-label">Cash</div><div class="fin-value">$${Math.round(fin.cash||0)}</div></div><div class="financial-item"><div class="fin-label">Savings</div><div class="fin-value">$${Math.round(fin.savings||0)}</div></div></div></div>`;
    const mems = a.recent_memories || [];
    if (mems.length > 0) {
      html += `<div class="detail-section"><h4>Recent Memories</h4>`;
      for (const m of mems.slice(0, 10)) {
        const icon = m.type === 'conversation' ? '\uD83D\uDCAC' : m.type === 'reflection' ? '\uD83D\uDCAD' : m.type === 'plan' ? '\uD83D\uDCCB' : '\u2022';
        html += `<div class="memory-item"><span class="mem-type">${icon}</span><span class="mem-content">${m.content}</span><span class="mem-importance">${m.importance?.toFixed(0)||''}</span></div>`;
      }
      html += `</div>`;
    }
    document.getElementById('detail-content').innerHTML = html;
  } catch (e) { console.error('Detail fetch error:', e); }
}

// ── Controls ────────────────────────────────────────────────
function setSpeed(spd) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'speed', value: spd }));
  } else {
    fetch(`/api/v1/simulation/speed/${spd}`, { method: 'POST' });
  }
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const mapping = { 0: 'btn-pause', 1: 'btn-1x', 10: 'btn-10x', 60: 'btn-60x', 120: 'btn-120x' };
  const btn = document.getElementById(mapping[spd]);
  if (btn) btn.classList.add('active');
}

// ── Phaser Map Scene ────────────────────────────────────────
// TILE is embedded in map_bg.png (16px * 2x scale = 32px per tile)

class SmallvilleScene extends Phaser.Scene {
  constructor() { super({ key: 'SmallvilleScene' }); }

  preload() {
    this.load.image('mapBg', '/assets/map_bg.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#7CB342');
    this.agentGroup = this.add.group();

    // Add pre-rendered map background
    const bg = this.add.image(0, 0, 'mapBg').setOrigin(0, 0).setDepth(0);
    const mapW = bg.width;
    const mapH = bg.height;

    this.cameras.main.setBounds(-50, -50, mapW + 100, mapH + 100);
    this.cameras.main.setZoom(0.55);
    this.cameras.main.centerOn(mapW / 2, mapH / 2);

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && pointer.button === 0) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    this.input.on('wheel', (pointer, objs, dx, dy) => {
      const z = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(z - dy * 0.001, 0.2, 2));
    });
    mapScene = this;
  }

  updateAgents() {
    if (!state || !state.agents) return;
    const T = 32; // Match map_bg.png: TILE=16 * SCALE=2
    const existingIds = new Set();

    for (const a of state.agents) {
      existingIds.add(a.id);
      const loc = (state.locations || {})[a.location_id];
      if (!loc || !loc.x) continue;

      let targetX = loc.x * T + (loc.width || 4) * T / 2;
      let targetY = loc.y * T + (loc.height || 4) * T + 8;

      const agentsAtLoc = state.agents.filter(b => b.location_id === a.location_id);
      const idx = agentsAtLoc.indexOf(a);
      targetX += (idx - agentsAtLoc.length / 2) * 12;

      if (!agentSprites[a.id]) {
        const container = this.add.container(targetX, targetY);
        // Shadow
        const shadow = this.add.ellipse(0, 6, 12, 4, 0x000000, 0.2);
        // Body
        const body = this.add.circle(0, 0, 8, 0xFFFFFF, 1);
        body.setStrokeStyle(2, 0x37474F);
        // Name
        const nameText = this.add.text(0, -16, a.name.split(' ')[0], {
          fontSize: '7px', fontFamily: 'sans-serif', color: '#37474F',
          fontStyle: 'bold',
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: { left: 3, right: 3, top: 1, bottom: 1 },
        }).setOrigin(0.5);
        // Activity
        const actText = this.add.text(0, 14, '', {
          fontSize: '6px', fontFamily: 'sans-serif', color: '#607D8B',
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: { left: 2, right: 2, top: 0, bottom: 0 },
        }).setOrigin(0.5);

        container.add([shadow, body, nameText, actText]);
        container.setDepth(10);
        container.setSize(16, 16);
        container.setInteractive();
        container.on('pointerdown', () => selectAgent(a.id));

        agentSprites[a.id] = { container, body, nameText, actText, x: targetX, y: targetY };
        this.agentGroup.add(container);
      }

      const sprite = agentSprites[a.id];
      const moodColor = a.emotion.valence > 0.2 ? 0x66BB6A : a.emotion.valence < -0.2 ? 0xEF5350 : 0xFFB74D;
      sprite.body.setFillStyle(moodColor);
      sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.08);
      sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.08);
      sprite.container.setPosition(sprite.x, sprite.y);

      const act = a.current_activity.replace(/_/g, ' ');
      sprite.actText.setText(act.length > 18 ? act.slice(0, 18) + '..' : act);

      if (a.is_moving) {
        sprite.body.setRadius(9 + Math.sin(Date.now() / 150) * 2);
      } else {
        sprite.body.setRadius(8);
      }
    }

    for (const id of Object.keys(agentSprites)) {
      if (!existingIds.has(id)) {
        agentSprites[id].container.destroy();
        delete agentSprites[id];
      }
    }
  }

  focusAgent(agentId) {
    const sprite = agentSprites[agentId];
    if (sprite) this.cameras.main.pan(sprite.x, sprite.y, 500, 'Sine.easeInOut');
  }
}

// ── Polling fallback ────────────────────────────────────────
let lastWsUpdate = 0;
setInterval(async () => {
  if (Date.now() - lastWsUpdate > 3000) {
    try {
      const resp = await fetch('/api/v1/state');
      state = await resp.json();
      updateUI();
    } catch (e) {}
  }
}, 3000);

// ── Init ────────────────────────────────────────────────────
window.addEventListener('load', () => {
  const container = document.getElementById('map-container');
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'map-container',
    width: container.clientWidth,
    height: container.clientHeight,
    backgroundColor: '#8BC34A',
    scene: [SmallvilleScene],
    scale: { mode: Phaser.Scale.NONE },
  });
  window.addEventListener('resize', () => {
    if (game && container) game.scale.resize(container.clientWidth, container.clientHeight);
  });
  connectWS();
});
