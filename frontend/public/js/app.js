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
const TILE = 12; // pixels per tile coordinate

class SmallvilleScene extends Phaser.Scene {
  constructor() { super({ key: 'SmallvilleScene' }); }

  create() {
    this.cameras.main.setBackgroundColor('#8BC34A');
    this.buildingGroup = this.add.group();
    this.agentGroup = this.add.group();
    this.drawMap();
    this.cameras.main.setBounds(-100, -100, 1600, 1200);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.centerOn(400, 300);

    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown && pointer.button === 0) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    this.input.on('wheel', (pointer, objs, dx, dy) => {
      const z = this.cameras.main.zoom;
      this.cameras.main.setZoom(Phaser.Math.Clamp(z - dy * 0.001, 0.5, 3));
    });
    mapScene = this;
  }

  drawMap() {
    // ── Ground layer ──
    const ground = this.add.graphics().setDepth(0);
    // Main grass
    ground.fillStyle(0x7CB342, 1);
    ground.fillRect(-100, -100, 1600, 1200);
    // Grass texture variations
    for (let i = 0; i < 80; i++) {
      ground.fillStyle([0x8BC34A, 0x689F38, 0x9CCC65][i % 3], 0.3);
      ground.fillEllipse(Math.random() * 1400 - 50, Math.random() * 1000 - 50, 30 + Math.random() * 50, 20 + Math.random() * 30);
    }

    // ── Roads ──
    this.drawRoads(ground);

    // ── Park ──
    this.drawPark(ground);

    // ── Sidewalks along roads ──
    this.drawSidewalks(ground);

    // ── Buildings ──
    if (state && state.locations) {
      for (const [locId, loc] of Object.entries(state.locations)) {
        if (loc.x && loc.y && BLDG[locId]) {
          if (locId === 'elm_park') continue; // Park drawn separately
          this.drawBuilding(locId, loc);
        }
      }
    }

    // ── Decorations ──
    this.drawDecorations(ground);

    // ── Street trees ──
    this.drawStreetTrees(ground);
  }

  drawRoads(g) {
    const T = TILE;
    // Road color + sidewalk
    const roadColor = 0x616161;
    const lineColor = 0xBDBDBD;

    // Main horizontal roads
    const roads = [
      { x: 0, y: 7, w: 75, h: 3 },   // Oak Lane (residential)
      { x: 0, y: 18, w: 75, h: 3 },   // Community Drive
      { x: 0, y: 26, w: 75, h: 4 },   // Main Street (wider)
      { x: 0, y: 40, w: 75, h: 3 },   // South Street
    ];
    // Vertical connectors
    const vroads = [
      { x: 7, y: 7, w: 2.5, h: 36 },  // West Ave
      { x: 20, y: 7, w: 2.5, h: 36 }, // Elm Drive
      { x: 35, y: 7, w: 2.5, h: 36 }, // Center St
      { x: 50, y: 7, w: 2.5, h: 36 }, // East Ave
      { x: 62, y: 18, w: 2.5, h: 25 },// Maple Ct
    ];

    // Draw all roads
    g.fillStyle(roadColor, 1);
    for (const r of [...roads, ...vroads]) {
      g.fillRect(r.x * T, r.y * T, r.w * T, r.h * T);
    }

    // Center line markings on main street
    g.lineStyle(1.5, lineColor, 0.6);
    for (const r of roads) {
      const cy = (r.y + r.h / 2) * T;
      for (let x = r.x * T; x < (r.x + r.w) * T; x += 20) {
        g.lineBetween(x, cy, x + 12, cy);
      }
    }
    for (const r of vroads) {
      const cx = (r.x + r.w / 2) * T;
      for (let y = r.y * T; y < (r.y + r.h) * T; y += 20) {
        g.lineBetween(cx, y, cx, y + 12);
      }
    }

    // Intersections (fill where roads cross)
    g.fillStyle(roadColor, 1);
    // Already covered by overlapping rectangles
  }

  drawSidewalks(g) {
    const T = TILE;
    g.fillStyle(0xD7CCC8, 0.7);
    // Sidewalks along horizontal roads
    const hroads = [7, 18, 26, 40];
    for (const ry of hroads) {
      g.fillRect(0, (ry - 0.5) * T, 75 * T, 0.5 * T);
      const roadH = ry === 26 ? 4 : 3;
      g.fillRect(0, (ry + roadH) * T, 75 * T, 0.5 * T);
    }
  }

  drawPark(g) {
    const T = TILE;
    const px = 14 * T, py = 0, pw = 22 * T, ph = 7 * T;

    // Park grass (lighter)
    g.fillStyle(0x81C784, 1);
    g.fillRoundedRect(px, py, pw, ph, 8);

    // Walking path
    g.lineStyle(3, 0xD7CCC8, 0.8);
    g.beginPath();
    g.moveTo(px + 20, py + ph - 10);
    g.lineTo(px + 60, py + 20);
    g.lineTo(px + 120, py + 30);
    g.lineTo(px + 180, py + 15);
    g.lineTo(px + pw - 20, py + ph - 10);
    g.strokePath();

    // Pond
    g.fillStyle(0x4FC3F7, 0.8);
    g.fillEllipse(px + 100, py + 40, 50, 30);
    g.fillStyle(0x81D4FA, 0.5);
    g.fillEllipse(px + 95, py + 37, 30, 18);

    // Gazebo
    g.fillStyle(0x795548, 1);
    g.fillCircle(px + 200, py + 35, 18);
    g.fillStyle(0x8D6E63, 1);
    g.fillCircle(px + 200, py + 35, 14);
    g.fillStyle(0xA1887F, 1);
    g.fillCircle(px + 200, py + 35, 10);
    // Gazebo roof
    g.fillStyle(0x5D4037, 0.8);
    g.fillCircle(px + 200, py + 30, 20);

    // Benches
    for (const [bx, by] of [[px + 40, py + 50], [px + 150, py + 55], [px + 230, py + 50]]) {
      g.fillStyle(0x6D4C41, 1);
      g.fillRect(bx, by, 16, 4);
      g.fillRect(bx + 2, by + 4, 2, 4);
      g.fillRect(bx + 12, by + 4, 2, 4);
    }

    // Trees in park
    for (let i = 0; i < 15; i++) {
      const tx = px + 15 + Math.random() * (pw - 30);
      const ty = py + 10 + Math.random() * (ph - 25);
      // Don't draw on pond or gazebo
      if (Math.abs(tx - px - 100) < 30 && Math.abs(ty - py - 40) < 20) continue;
      if (Math.abs(tx - px - 200) < 25 && Math.abs(ty - py - 35) < 25) continue;
      this.drawTree(g, tx, ty, 1.2 + Math.random() * 0.6);
    }

    // Flower patches
    const flowerColors = [0xFF5252, 0xFFD740, 0xFF4081, 0xE040FB, 0x448AFF];
    for (let i = 0; i < 20; i++) {
      g.fillStyle(flowerColors[i % flowerColors.length], 0.8);
      g.fillCircle(px + 10 + Math.random() * (pw - 20), py + ph - 15 + Math.random() * 10, 2);
    }

    // Label
    this.add.text(px + pw / 2, py + 8, 'Elm Park', {
      fontSize: '10px', fontFamily: 'Georgia, serif', color: '#1B5E20',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(4);
  }

  drawBuilding(id, loc) {
    const T = TILE;
    const style = BLDG[id];
    const x = loc.x * T;
    const y = loc.y * T;
    const w = loc.width * T;
    const h = loc.height * T;
    const g = this.add.graphics().setDepth(2);

    const isOutdoor = id === 'elm_park';

    // ── Shadow ──
    g.fillStyle(0x000000, 0.12);
    g.fillRoundedRect(x + 4, y + 4, w, h, 3);

    // ── Building body ──
    g.fillStyle(style.body, 1);
    g.fillRoundedRect(x, y, w, h, 3);

    // ── Outline ──
    g.lineStyle(1.5, style.trim, 0.6);
    g.strokeRoundedRect(x, y, w, h, 3);

    // ── Roof ──
    if (style.roofStyle === 'gable') {
      // Triangular roof
      g.fillStyle(style.roof, 1);
      g.fillTriangle(x - 4, y, x + w + 4, y, x + w / 2, y - 14);
      g.lineStyle(1, style.trim, 0.5);
      g.strokeTriangle(x - 4, y, x + w + 4, y, x + w / 2, y - 14);
    } else if (style.roofStyle === 'hip') {
      g.fillStyle(style.roof, 1);
      g.fillTriangle(x - 3, y + 2, x + w + 3, y + 2, x + w / 2, y - 12);
      g.fillRect(x, y - 2, w, 4);
    } else if (style.roofStyle === 'flat') {
      g.fillStyle(style.roof, 1);
      g.fillRect(x - 2, y - 4, w + 4, 6);
      g.lineStyle(1, style.trim, 0.4);
      g.lineBetween(x - 2, y - 4, x + w + 2, y - 4);
    } else if (style.roofStyle === 'awning') {
      // Cafe awning — striped
      const stripeW = 6;
      for (let sx = x - 3; sx < x + w + 3; sx += stripeW) {
        g.fillStyle(((sx / stripeW | 0) % 2 === 0) ? style.roof : 0xFFFFFF, 1);
        g.fillRect(sx, y - 6, stripeW, 8);
      }
    } else if (style.roofStyle === 'column') {
      // Government building with columns
      g.fillStyle(style.roof, 1);
      g.fillRect(x - 3, y - 6, w + 6, 8);
      // Columns
      g.fillStyle(0xECEFF1, 1);
      for (let cx = x + 6; cx < x + w - 4; cx += 14) {
        g.fillRect(cx, y, 4, h);
      }
    }

    // ── Windows ──
    g.fillStyle(0xBBDEFB, 0.9);
    const winW = style.big ? 7 : 5;
    const winH = style.big ? 6 : 4;
    const padX = style.big ? 10 : 7;
    const padY = style.big ? 14 : 10;
    const cols = Math.max(1, Math.floor((w - padX * 2 + 4) / (winW + 4)));
    const rows = Math.max(1, Math.floor((h - padY - 8) / (winH + 4)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + padX + c * (winW + 4);
        const wy = y + padY + r * (winH + 4);
        g.fillStyle(0xBBDEFB, 0.9);
        g.fillRect(wx, wy, winW, winH);
        // Window frame
        g.lineStyle(0.5, style.trim, 0.5);
        g.strokeRect(wx, wy, winW, winH);
        // Cross pane
        g.lineBetween(wx + winW / 2, wy, wx + winW / 2, wy + winH);
        g.lineBetween(wx, wy + winH / 2, wx + winW, wy + winH / 2);
        // Light reflection
        g.fillStyle(0xFFFFFF, 0.3);
        g.fillRect(wx + 1, wy + 1, 2, 2);
      }
    }

    // ── Door ──
    const doorW = style.big ? 8 : 6;
    const doorH = style.big ? 12 : 9;
    g.fillStyle(style.trim, 1);
    g.fillRoundedRect(x + w / 2 - doorW / 2, y + h - doorH - 1, doorW, doorH, 1);
    // Doorknob
    g.fillStyle(0xFFD54F, 1);
    g.fillCircle(x + w / 2 + doorW / 4, y + h - doorH / 2 - 1, 1.5);

    // ── Accent detail ──
    if (style.accent && style.roofStyle !== 'none') {
      g.fillStyle(style.accent, 0.6);
      g.fillRect(x + 2, y + h - 3, w - 4, 2); // Foundation accent
    }

    // ── Special: Medical cross ──
    if (id === 'medical_center') {
      g.fillStyle(0xFF0000, 0.9);
      const cx = x + w / 2, cy = y - 14;
      g.fillRect(cx - 1, cy - 5, 3, 10);
      g.fillRect(cx - 5, cy - 1, 10, 3);
    }

    // ── Special: School flag ──
    if (id === 'school') {
      g.fillStyle(0x795548, 1);
      g.fillRect(x + w - 10, y - 20, 2, 22);
      g.fillStyle(0x1565C0, 1);
      g.fillTriangle(x + w - 8, y - 20, x + w - 8, y - 12, x + w, y - 16);
    }

    // ── Label ──
    const labelY = style.roofStyle === 'gable' || style.roofStyle === 'hip' ? y - 18 : y - 10;
    this.add.text(x + w / 2, labelY, style.label, {
      fontSize: style.big ? '10px' : '8px',
      fontFamily: 'sans-serif',
      color: '#37474F',
      fontStyle: 'bold',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: { left: 4, right: 4, top: 2, bottom: 2 },
    }).setOrigin(0.5, 1).setDepth(5);

    locationMarkers[id] = { x: x + w / 2, y: y + h / 2 };
  }

  drawTree(g, x, y, scale) {
    const s = scale || 1;
    // Trunk
    g.fillStyle(0x6D4C41, 1);
    g.fillRect(x - 1 * s, y + 2 * s, 2.5 * s, 8 * s);
    // Shadow canopy
    g.fillStyle(0x2E7D32, 0.6);
    g.fillCircle(x + 1, y, 8 * s);
    // Main canopy
    g.fillStyle(0x388E3C, 1);
    g.fillCircle(x, y - 1, 7 * s);
    // Highlight
    g.fillStyle(0x66BB6A, 0.7);
    g.fillCircle(x - 2 * s, y - 3 * s, 4 * s);
  }

  drawStreetTrees(g) {
    const T = TILE;
    // Trees along Oak Lane
    for (let x = 3; x < 72; x += 4) {
      if (Math.random() > 0.25) {
        this.drawTree(g, x * T, 6.2 * T, 0.7);
        this.drawTree(g, x * T, 10.5 * T, 0.7);
      }
    }
    // Trees along Main Street
    for (let x = 3; x < 72; x += 5) {
      if (Math.random() > 0.3) {
        this.drawTree(g, x * T, 25.2 * T, 0.7);
        this.drawTree(g, x * T, 30.5 * T, 0.7);
      }
    }
    // Along Community Drive
    for (let x = 3; x < 72; x += 5) {
      if (Math.random() > 0.4) {
        this.drawTree(g, x * T, 17.2 * T, 0.6);
      }
    }
  }

  drawDecorations(g) {
    const T = TILE;
    // Cars on roads
    const carColors = [0x1565C0, 0xC62828, 0x2E7D32, 0x37474F, 0xF57F17, 0x4527A0];
    // Parked cars on Oak Lane
    for (let i = 0; i < 4; i++) {
      const cx = (8 + i * 12) * T;
      const cy = 10.8 * T;
      g.fillStyle(carColors[i], 1);
      g.fillRoundedRect(cx, cy, 10, 5, 2);
      g.fillStyle(0x90CAF9, 0.8);
      g.fillRect(cx + 2, cy + 1, 4, 3);
      // Wheels
      g.fillStyle(0x212121, 1);
      g.fillCircle(cx + 2, cy + 5, 1.5);
      g.fillCircle(cx + 8, cy + 5, 1.5);
    }
    // Cars on Main Street
    for (let i = 0; i < 3; i++) {
      const cx = (15 + i * 18) * T;
      const cy = 27.5 * T;
      g.fillStyle(carColors[3 + i] || carColors[0], 1);
      g.fillRoundedRect(cx, cy, 10, 5, 2);
      g.fillStyle(0x90CAF9, 0.8);
      g.fillRect(cx + 2, cy + 1, 4, 3);
      g.fillStyle(0x212121, 1);
      g.fillCircle(cx + 2, cy + 5, 1.5);
      g.fillCircle(cx + 8, cy + 5, 1.5);
    }

    // Mailboxes near houses
    for (let i = 0; i < 6; i++) {
      const mx = (11 + i * 8) * T;
      const my = 10.3 * T;
      g.fillStyle(0x1565C0, 1);
      g.fillRect(mx, my, 3, 5);
      g.fillStyle(0x1565C0, 1);
      g.fillRect(mx - 1, my, 5, 2);
      // Post
      g.fillStyle(0x795548, 1);
      g.fillRect(mx + 1, my + 5, 1.5, 4);
    }

    // Street lamps along Main Street
    for (let x = 5; x < 70; x += 8) {
      const lx = x * T;
      const ly = 25 * T;
      g.fillStyle(0x757575, 1);
      g.fillRect(lx, ly, 1.5, 12);
      g.fillStyle(0x424242, 1);
      g.fillRect(lx - 2, ly - 2, 5.5, 3);
      // Lamp glow
      g.fillStyle(0xFFF9C4, 0.4);
      g.fillCircle(lx + 0.75, ly - 1, 5);
    }

    // Fences around Elm Park
    g.lineStyle(1.5, 0x8D6E63, 0.5);
    const px = 14 * T, pw = 22 * T;
    for (let fx = px; fx < px + pw; fx += 8) {
      g.lineBetween(fx, 0, fx, -6);
      g.lineBetween(fx, -6, fx + 8, -6);
    }

    // Bike rack near Sunrise Cafe
    g.fillStyle(0x757575, 1);
    g.fillRect(6 * T, 22 * T, 12, 2);
    for (let bx = 0; bx < 3; bx++) {
      g.fillRect((6 * T) + bx * 4, 22 * T - 4, 1.5, 4);
    }
  }

  updateAgents() {
    if (!state || !state.agents) return;
    const T = TILE;
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
