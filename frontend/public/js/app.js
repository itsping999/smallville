// ── State ───────────────────────────────────────────────────
let state = null;
let selectedAgentId = null;
let ws = null;
let game = null;
let mapScene = null;
const agentSprites = {};
const locationMarkers = {};

// ── Location rendering config ───────────────────────────────
const LOCATION_STYLES = {
  house_1: { color: 0xFFAB91, roof: 0xD84315, label: "Chen" },
  house_2: { color: 0x81D4FA, roof: 0x0277BD, label: "Williams" },
  house_3: { color: 0xC5E1A5, roof: 0x558B2F, label: "Henderson" },
  house_4: { color: 0xF0F4C3, roof: 0x827717, label: "Patel" },
  house_5: { color: 0xFFCCBC, roof: 0xBF360C, label: "Moreno" },
  house_6: { color: 0xD1C4E9, roof: 0x4527A0, label: "Fisher" },
  apt_101: { color: 0xB2DFDB, roof: 0x00695C, label: "Apt 101" },
  apt_102: { color: 0xB2DFDB, roof: 0x00695C, label: "Apt 102" },
  sunrise_cafe: { color: 0xFFF9C4, roof: 0xF9A825, label: "Sunrise Cafe" },
  greenleaf_grocery: { color: 0xC8E6C9, roof: 0x2E7D32, label: "Grocery" },
  birch_barrel: { color: 0xD7CCC8, roof: 0x4E342E, label: "Birch & Barrel" },
  pages_bookstore: { color: 0xF8BBD0, roof: 0xAD1457, label: "Bookstore" },
  corner_pharmacy: { color: 0xE1F5FE, roof: 0x01579B, label: "Pharmacy" },
  school: { color: 0xFFF3E0, roof: 0xE65100, label: "School" },
  school_classroom_a: { color: 0xFFE0B2, roof: 0xEF6C00, label: "Classroom" },
  community_center: { color: 0xE8EAF6, roof: 0x283593, label: "Community Ctr" },
  elm_park: { color: 0x81C784, roof: 0x1B5E20, label: "Elm Park" },
  fire_station: { color: 0xEF9A9A, roof: 0xB71C1C, label: "Fire Station" },
  town_hall: { color: 0xE0E0E0, roof: 0x424242, label: "Town Hall" },
  riverside_tech: { color: 0xB3E5FC, roof: 0x0277BD, label: "Riverside Tech" },
  medical_center: { color: 0xF3E5F5, roof: 0x6A1B9A, label: "Medical Center" },
  library: { color: 0xFFE0B2, roof: 0x795548, label: "Library" },
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
  // Highlight active speed button
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

    let html = '';

    html += `<div class="detail-section">
      <h4>About</h4>
      <div class="bio">${a.occupation} \u00B7 ${a.life_stage || ''}</div>
      <div class="bio" style="margin-top:4px">${a.bio || ''}</div>
      <div class="bio" style="margin-top:4px;color:#4CAF50">
        ${a.has_car ? '\uD83D\uDE97' : ''} ${a.has_bicycle ? '\uD83D\uDEB2' : ''} Currently at ${locName}
      </div>
    </div>`;

    const n = a.needs || {};
    html += `<div class="detail-section"><h4>Needs</h4>`;
    for (const [key, val] of Object.entries(n)) {
      const color = val < 30 ? '#E57373' : val < 60 ? '#FFB74D' : '#81C784';
      html += `<div class="need-bar">
        <span class="label">${key}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${val}%;background:${color}"></div></div>
        <span class="value">${Math.round(val)}</span>
      </div>`;
    }
    html += `</div>`;

    const emo = a.emotion || {};
    html += `<div class="detail-section">
      <h4>Mood</h4>
      <div class="mood-display">
        <span class="mood-emoji">${emo.emoji || '\uD83D\uDE10'}</span>
        <div>
          <div class="mood-label">${emo.dominant || 'neutral'}</div>
          <div class="mood-values">Valence: ${(emo.valence||0).toFixed(2)} \u00B7 Arousal: ${(emo.arousal||0).toFixed(2)}</div>
        </div>
      </div>
    </div>`;

    const fin = a.financial || {};
    html += `<div class="detail-section">
      <h4>Financial</h4>
      <div class="financial-grid">
        <div class="financial-item"><div class="fin-label">Cash</div><div class="fin-value">$${Math.round(fin.cash||0)}</div></div>
        <div class="financial-item"><div class="fin-label">Savings</div><div class="fin-value">$${Math.round(fin.savings||0)}</div></div>
        <div class="financial-item"><div class="fin-label">Disposition</div><div class="fin-value">${fin.disposition||'moderate'}</div></div>
      </div>
    </div>`;

    const mems = a.recent_memories || [];
    if (mems.length > 0) {
      html += `<div class="detail-section"><h4>Recent Memories</h4>`;
      for (const m of mems.slice(0, 10)) {
        const icon = m.type === 'conversation' ? '\uD83D\uDCAC' : m.type === 'reflection' ? '\uD83D\uDCAD' : m.type === 'plan' ? '\uD83D\uDCCB' : '\u2022';
        html += `<div class="memory-item">
          <span class="mem-type">${icon}</span>
          <span class="mem-content">${m.content}</span>
          <span class="mem-importance">${m.importance?.toFixed(0)||''}</span>
        </div>`;
      }
      html += `</div>`;
    }

    const rels = a.relationships || [];
    if (rels.length > 0) {
      html += `<div class="detail-section"><h4>Relationships</h4>`;
      for (const r of rels) {
        html += `<div class="relationship-item">
          <span class="rel-name">${r.name}</span>
          <span class="rel-type">${r.type}</span>
          <span class="rel-closeness">${(r.closeness*100).toFixed(0)}%</span>
        </div>`;
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
    // Fallback: use REST API
    fetch(`/api/v1/simulation/speed/${spd}`, { method: 'POST' });
  }
  // Optimistic UI update
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const mapping = { 0: 'btn-pause', 1: 'btn-1x', 10: 'btn-10x', 60: 'btn-60x', 120: 'btn-120x' };
  const btn = document.getElementById(mapping[spd]);
  if (btn) btn.classList.add('active');
}

// ── Phaser Map Scene ────────────────────────────────────────
class SmallvilleScene extends Phaser.Scene {
  constructor() { super({ key: 'SmallvilleScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#C8E6C9');
    this.buildingGroup = this.add.group();
    this.agentGroup = this.add.group();
    this.labelGroup = this.add.group();

    this.drawMap();

    this.cameras.main.setBounds(-200, -200, 2400, 1600);
    this.cameras.main.setZoom(1.2);
    this.cameras.main.centerOn(350, 300);

    // Pan with drag — use pointer events that don't conflict with UI
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && pointer.button === 0) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });

    this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(zoom - dy * 0.001, 0.4, 2.5));
    });

    mapScene = this;
  }

  drawMap() {
    const g = this.add.graphics();
    g.setDepth(0);

    g.fillStyle(0x7CB342, 1);
    g.fillRect(-200, -200, 2400, 1600);

    g.fillStyle(0x8BC34A, 0.4);
    for (let i = 0; i < 40; i++) {
      g.fillEllipse(Math.random() * 1200 - 100, Math.random() * 800 - 100, 60 + Math.random() * 80, 40 + Math.random() * 60);
    }

    // Roads
    g.fillStyle(0x78909C, 1);
    g.fillRect(0, 260, 700, 40);
    g.fillRect(0, 100, 700, 30);
    g.fillRect(340, 100, 30, 200);
    g.fillRect(0, 170, 700, 25);
    g.fillRect(0, 460, 700, 30);

    g.fillStyle(0xBDBDBD, 0.5);
    g.fillRect(0, 255, 700, 5);
    g.fillRect(0, 300, 700, 5);
    g.fillRect(0, 95, 700, 5);
    g.fillRect(0, 130, 700, 5);

    // Park
    g.fillStyle(0x4CAF50, 0.6);
    g.fillRoundedRect(150, 10, 200, 80, 10);
    g.fillStyle(0x4FC3F7, 0.7);
    g.fillEllipse(230, 40, 50, 30);
    for (let i = 0; i < 8; i++) this.drawTree(g, 160 + i * 22, 20 + (i % 3) * 20);

    if (state && state.locations) {
      for (const [locId, loc] of Object.entries(state.locations)) {
        if (loc.x && loc.y) this.drawBuilding(locId, loc.x * 8, loc.y * 8, loc);
      }
    }

    for (let x = 20; x < 700; x += 50) {
      if (Math.random() > 0.3) {
        this.drawTree(g, x, 85 + Math.random() * 5);
        this.drawTree(g, x, 305 + Math.random() * 5);
      }
    }
  }

  drawBuilding(locId, x, y, loc) {
    const style = LOCATION_STYLES[locId] || { color: 0xFFCC80, roof: 0xBF360C, label: locId };
    const w = (loc.width || 4) * 8;
    const h = (loc.height || 4) * 8;

    const g = this.add.graphics();
    g.setDepth(1);

    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(x + 3, y + 3, w, h, 3);
    g.fillStyle(style.color, 1);
    g.fillRoundedRect(x, y, w, h, 3);
    g.fillStyle(style.roof, 1);
    g.fillRoundedRect(x - 2, y - 6, w + 4, 8, 2);

    g.fillStyle(0xBBDEFB, 0.9);
    const cols = Math.max(1, Math.floor((w - 10) / 12));
    const rows = Math.max(1, Math.floor((h - 15) / 12));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        g.fillRect(x + 8 + c * 12, y + 10 + r * 12, 5, 5);

    g.fillStyle(0x795548, 1);
    g.fillRect(x + w/2 - 3, y + h - 10, 6, 10);

    const text = this.add.text(x + w/2, y - 12, style.label, {
      fontSize: '9px', fontFamily: 'sans-serif', color: '#37474F',
      backgroundColor: 'rgba(255,255,255,0.8)', padding: { left: 3, right: 3, top: 1, bottom: 1 },
    }).setOrigin(0.5, 1).setDepth(3);
    this.labelGroup.add(text);

    this.buildingGroup.add(g);
    locationMarkers[locId] = { x: x + w/2, y: y + h/2 };
  }

  drawTree(g, x, y) {
    g.fillStyle(0x6D4C41, 1);
    g.fillRect(x - 1, y + 4, 3, 6);
    g.fillStyle(0x388E3C, 1);
    g.fillCircle(x, y, 6);
    g.fillStyle(0x4CAF50, 0.7);
    g.fillCircle(x - 2, y - 2, 4);
  }

  updateAgents() {
    if (!state || !state.agents) return;

    const existingIds = new Set();
    for (const a of state.agents) {
      existingIds.add(a.id);
      const loc = (state.locations || {})[a.location_id];
      if (!loc || !loc.x) continue;

      let targetX = loc.x * 8 + (loc.width || 4) * 4;
      let targetY = loc.y * 8 + (loc.height || 4) * 4 + 10;

      const agentsAtLoc = state.agents.filter(b => b.location_id === a.location_id);
      const idx = agentsAtLoc.indexOf(a);
      targetX += (idx - agentsAtLoc.length / 2) * 14;

      if (!agentSprites[a.id]) {
        const container = this.add.container(targetX, targetY);
        const circle = this.add.circle(0, 0, 7, 0xFFFFFF, 1);
        circle.setStrokeStyle(2, 0x37474F);
        const nameText = this.add.text(0, -14, a.name.split(' ')[0], {
          fontSize: '8px', fontFamily: 'sans-serif', color: '#37474F',
          backgroundColor: 'rgba(255,255,255,0.7)', padding: { left: 2, right: 2, top: 0, bottom: 0 },
        }).setOrigin(0.5);
        const actText = this.add.text(0, 12, '', {
          fontSize: '7px', fontFamily: 'sans-serif', color: '#607D8B',
        }).setOrigin(0.5);

        container.add([circle, nameText, actText]);
        container.setDepth(5);
        container.setSize(14, 14);
        container.setInteractive();
        container.on('pointerdown', () => selectAgent(a.id));

        agentSprites[a.id] = { container, circle, nameText, actText, x: targetX, y: targetY };
        this.agentGroup.add(container);
      }

      const sprite = agentSprites[a.id];
      const moodColor = a.emotion.valence > 0.2 ? 0x4CAF50 : a.emotion.valence < -0.2 ? 0xE57373 : 0xFFB74D;
      sprite.circle.setFillStyle(moodColor);
      sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.1);
      sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.1);
      sprite.container.setPosition(sprite.x, sprite.y);

      const act = a.current_activity.replace(/_/g, ' ');
      sprite.actText.setText(act.length > 15 ? act.slice(0, 15) + '...' : act);

      if (a.is_moving) {
        sprite.circle.setRadius(8 + Math.sin(Date.now() / 200) * 2);
      } else {
        sprite.circle.setRadius(7);
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

// ── Polling fallback: fetch state every 3s if WS is silent ──
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
    backgroundColor: '#C8E6C9',
    scene: [SmallvilleScene],
    scale: {
      mode: Phaser.Scale.NONE,
    },
  });

  window.addEventListener('resize', () => {
    if (game && container) {
      game.scale.resize(container.clientWidth, container.clientHeight);
    }
  });

  connectWS();
});

// Track WS message time
const origOnMsg = null;
