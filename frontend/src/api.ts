export interface PersonaName {
  original: string;
  underscore: string;
  initial: string;
}

export interface SimStatus {
  sim_code: string;
  step: number;
  persona_names: PersonaName[];
  persona_init_pos: { name: string; x: number; y: number }[];
}

export interface DemoData {
  sim_code: string;
  step: number;
  persona_names: PersonaName[];
  persona_init_pos: Record<string, [number, number]>;
  all_movement: Record<number, any>;
  start_datetime: string;
  sec_per_step: number;
  play_speed: number;
  mode: string;
}

export interface MovementData {
  "<step>": number;
  meta?: { curr_time: string };
  persona?: Record<string, {
    movement: [number, number];
    pronunciatio: string;
    description: string;
    chat: [string, string][] | null;
  }>;
}

export interface DemoSummary {
  sim_code: string;
  start_date: string;
  sec_per_step: number;
  default_step: number;
}

export interface SaveItem {
  sim_code: string;
  title: string;
  category: "demo" | "base" | "live";
  is_base: boolean;
  start_date?: string | null;
  sec_per_step?: number;
  step?: number;
  default_step?: number;
  persona_names: PersonaName[];
  can_replay: boolean;
  can_live: boolean;
}

export interface SavesResponse {
  demos: SaveItem[];
  simulations: SaveItem[];
  templates: SaveItem[];
  saves: SaveItem[];
}

export interface LlmConfig {
  base_url: string;
  model: string;
  completion_model: string;
  embedding_model: string;
  disable_embeddings: boolean;
  api_key_configured: boolean;
}

export interface ReverieStatus {
  enabled: boolean;
  running: boolean;
  thread_alive: boolean;
  sim_code: string;
  fork_sim_code: string;
  step: number | null;
  curr_time: string | null;
  error: string | null;
}

export async function fetchSimStatus(): Promise<SimStatus> {
  const res = await fetch("/api/simulation/status");
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return res.json();
}

export async function fetchDemos(): Promise<DemoSummary[]> {
  const res = await fetch("/api/demos");
  if (!res.ok) throw new Error(`Demos ${res.status}`);
  const data = await res.json();
  return data.demos || [];
}

export async function fetchDemoData(
  simCode: string,
  step: number,
  playSpeed = 2
): Promise<DemoData> {
  const res = await fetch(`/api/demo/${simCode}/${step}?play_speed=${playSpeed}`);
  if (!res.ok) throw new Error(`Demo ${res.status}`);
  return res.json();
}

export async function sendEnvironment(data: {
  step: number;
  sim_code: string;
  environment: Record<string, { maze: string; x: number; y: number }>;
}): Promise<void> {
  await fetch("/api/environment/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchMovement(
  step: number,
  sim_code: string
): Promise<MovementData> {
  const res = await fetch("/api/environment/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, sim_code }),
  });
  return res.json();
}

export async function fetchSaves(): Promise<SavesResponse> {
  const res = await fetch("/api/saves");
  if (!res.ok) throw new Error(`Saves ${res.status}`);
  return res.json();
}

export async function fetchLlmConfig(): Promise<LlmConfig> {
  const res = await fetch("/api/config/llm");
  if (!res.ok) throw new Error(`LLM Config ${res.status}`);
  return res.json();
}

export async function fetchReverieStatus(): Promise<ReverieStatus> {
  const res = await fetch("/api/reverie/status");
  if (!res.ok) throw new Error(`Reverie Status ${res.status}`);
  return res.json();
}

export async function startSimulation(
  forkSimCode: string,
  simCode?: string
): Promise<{ status: string; sim_code: string; fork_sim_code: string }> {
  const res = await fetch("/api/simulation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fork_sim_code: forkSimCode, sim_code: simCode }),
  });
  if (!res.ok) throw new Error(`Start simulation failed: ${res.status}`);
  return res.json();
}

export async function stopSimulation(): Promise<{ status: string }> {
  const res = await fetch("/api/simulation/stop", {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Stop simulation failed: ${res.status}`);
  return res.json();
}

export async function deleteSave(
  simCode: string
): Promise<{ status: string; deleted: string }> {
  const res = await fetch(`/api/saves/${encodeURIComponent(simCode)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Delete failed: ${res.status}` }));
    throw new Error(err.detail || `Delete failed: ${res.status}`);
  }
  return res.json();
}


