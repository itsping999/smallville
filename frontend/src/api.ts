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
