import { useEffect, useState, useCallback, useMemo } from "react";
import PhaserGame from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { DemoData } from "../api";
import { fetchDemoData } from "../api";

interface Props { simCode: string; step: number; }
interface PersonaState { description: string; chat: [string, string][] | null; }
interface ReplayStats {
  firstStep: number;
  lastStep: number;
  currentFrame: number;
  totalFrames: number;
  nextStep: number | null;
  percent: number;
  stepPercent: number;
}

function personaKey(name: string) {
  return name.replace(/\s+/g, "_");
}

function formatReplayTime(demo: DemoData, movementStep: number) {
  const current = new Date(demo.start_datetime);
  current.setSeconds(current.getSeconds() + (movementStep - demo.step) * demo.sec_per_step);
  return current.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeMovement(demo: DemoData) {
  const movement: Record<string, any> = {};

  for (const [rawStep, rawFrame] of Object.entries(demo.all_movement)) {
    const frame = rawFrame as any;
    const rawPersona = frame?.persona && typeof frame.persona === "object" ? frame.persona : frame;
    const persona: Record<string, any> = {};

    for (const [name, data] of Object.entries(rawPersona || {})) {
      persona[personaKey(name)] = data;
    }

    const movementStep = Number(rawStep);
    movement[String(rawStep)] = {
      ...(frame?.persona ? frame : {}),
      persona,
      meta: {
        ...(frame?.meta || {}),
        curr_time: frame?.meta?.curr_time || formatReplayTime(demo, movementStep),
      },
    };
  }

  return movement;
}

function summarizeState(state?: PersonaState) {
  const [rawAction = "", ...locationParts] = (state?.description || "").split("@");
  const action = rawAction.trim() || "Waiting for the next recorded action";
  const location = locationParts.join("@").trim() || "Location not reported yet";
  const chatText = state?.chat?.length
    ? state.chat.map(([who, msg]) => `${who}: ${msg}`).join("\n")
    : "No active conversation";

  return { action, location, chatText };
}

function getReplayStats(movementSteps: number[], currentStep: number, fallbackStep: number): ReplayStats {
  const totalFrames = movementSteps.length;
  const firstStep = movementSteps[0] ?? fallbackStep;
  const lastStep = movementSteps[totalFrames - 1] ?? firstStep;
  const exactIndex = movementSteps.indexOf(currentStep);
  const nextIndex = movementSteps.findIndex((candidate) => candidate > currentStep);
  const currentIndex = exactIndex >= 0
    ? exactIndex
    : nextIndex === -1
      ? Math.max(0, totalFrames - 1)
      : Math.max(0, nextIndex - 1);
  const percent = totalFrames > 1 ? (currentIndex / (totalFrames - 1)) * 100 : 0;
  const stepPercent = lastStep > firstStep
    ? ((currentStep - firstStep) / (lastStep - firstStep)) * 100
    : 0;

  return {
    firstStep,
    lastStep,
    currentFrame: totalFrames ? currentIndex + 1 : 0,
    totalFrames,
    nextStep: nextIndex === -1 ? null : movementSteps[nextIndex],
    percent: Math.min(100, Math.max(0, percent)),
    stepPercent: Math.min(100, Math.max(0, stepPercent)),
  };
}

export default function DemoPage({ simCode, step }: Props) {
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [error, setError] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(step);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    fetchDemoData(simCode, step).then(setDemo).catch((e) => setError(e.message));
  }, [simCode, step]);

  useEffect(() => {
    setCurrentStep(step);
    setPersonaStates({});
    setSelectedPersona(null);
    setIsPlaying(true);
  }, [simCode, step]);

  const onPersonaUpdate = useCallback((name: string, data: any) => {
    setPersonaStates((prev) => ({
      ...prev,
      [name]: { description: data.description || "", chat: data.chat || null },
    }));
  }, []);
  const onStepChange = useCallback((s: number) => setCurrentStep(s), []);
  const movement = useMemo(() => (demo ? normalizeMovement(demo) : {}), [demo]);
  const movementSteps = useMemo(() => (
    demo
      ? Object.keys(demo.all_movement).map(Number).filter(Number.isFinite).sort((a, b) => a - b)
      : []
  ), [demo]);
  const replayStats = useMemo(
    () => getReplayStats(movementSteps, currentStep, step),
    [movementSteps, currentStep, step],
  );

  if (error) {
    return (
      <div className="error-page">
        <h2>Demo not found</h2>
        <p>Simulation "{simCode}" at step {step} could not be loaded.</p>
      </div>
    );
  }

  if (!demo) return <div className="loading">Loading demo...</div>;

  const startDate = new Date(demo.start_datetime);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const displayTime = formatReplayTime(demo, currentStep);
  const latestStates = demo.persona_names.map((p) => ({
    ...p,
    state: personaStates[p.underscore] ?? personaStates[p.original],
    avatar: `/static/assets/characters/profile/${p.underscore}.png`,
  }));

  return (
    <div className="page workspace-page">
      <header className="workspace-header">
        <div className="workspace-title">
          <span className="mode-pill">Replay demo</span>
          <h1>Smallville Observation Desk</h1>
          <p>Generative Agents replay / {demo.sim_code.replace(/_/g, " ")}</p>
        </div>
        <div className="workspace-stats" aria-label="Replay status">
          <div>
            <span>Agents</span>
            <strong>{demo.persona_names.length}</strong>
          </div>
          <div>
            <span>Step</span>
            <strong>{currentStep}</strong>
          </div>
          <div>
            <span>Frame</span>
            <strong>{replayStats.currentFrame}/{replayStats.totalFrames}</strong>
          </div>
          <div>
            <span>Tick</span>
            <strong>{demo.sec_per_step}s</strong>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="map-window" aria-label="Town map">
          <div className="map-window-header">
            <div>
              <span className="section-kicker">Town map</span>
              <h2>{displayTime}</h2>
            </div>
            <div className="replay-actions">
              <button
                type="button"
                className="icon-control"
                onClick={() => setIsPlaying((value) => !value)}
                aria-label={isPlaying ? "Pause replay" : "Play replay"}
                title={isPlaying ? "Pause replay" : "Play replay"}
              >
                <span className={isPlaying ? "pause-icon" : "play-icon"} aria-hidden="true" />
              </button>
              <span className={isPlaying ? "window-status live" : "window-status"}>
                {isPlaying ? "Playing" : "Paused"}
              </span>
            </div>
          </div>
          <div className="replay-progress" aria-label="Replay progress">
            <div className="progress-copy">
              <span>Recorded frame {replayStats.currentFrame} / {replayStats.totalFrames}</span>
              <span>Step range {replayStats.firstStep} - {replayStats.lastStep}</span>
              <span>{replayStats.nextStep ? `Next recorded step ${replayStats.nextStep}` : "Replay complete"}</span>
            </div>
            <div className="timeline-track" aria-hidden="true">
              <span style={{ width: `${replayStats.percent}%` }} />
            </div>
            <div className="step-track" aria-hidden="true">
              <span style={{ width: `${replayStats.stepPercent}%` }} />
            </div>
          </div>
          <PhaserGame
            mode="demo"
            simCode={demo.sim_code}
            step={demo.step}
            personaInitPos={demo.persona_init_pos}
            allMovement={movement}
            playSpeed={demo.play_speed}
            isPlaying={isPlaying}
            onPersonaUpdate={onPersonaUpdate}
            onStepChange={onStepChange}
          />
        </section>

        <aside className="info-panel" aria-label="Simulation details">
          <section className="side-section">
            <span className="section-kicker">Current time</span>
            <h2>{displayTime}</h2>
            <div className="time-meta">
              <span>Started {dateStr}</span>
              <span>Replay speed x{demo.play_speed}</span>
            </div>
          </section>

          <section className="side-section">
            <div className="section-heading">
              <span className="section-kicker">Roster</span>
              <span>{demo.persona_names.length} active</span>
            </div>
            <div className="persona-grid">
              {latestStates.map((p) => (
                <button
                  key={p.underscore}
                  type="button"
                  className="persona-chip"
                  onClick={() => setSelectedPersona(p.underscore)}
                  aria-label={`${p.original} state details`}
                >
                  <img
                    src={p.avatar}
                    alt={p.original}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/static/img/atlas.png"; }}
                  />
                  <span>{p.initial}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="side-section activity-section">
            <div className="section-heading">
              <span className="section-kicker">Agent activity</span>
              <span>Step {currentStep}</span>
            </div>

            <div className="persona-list">
              {latestStates.map((p) => {
                const summary = summarizeState(p.state);

                return (
                  <article key={p.underscore} className="persona-card">
                    <div className="persona-card-header">
                      <img
                        src={p.avatar}
                        alt={p.original}
                        onError={(e) => { (e.target as HTMLImageElement).src = "/static/img/atlas.png"; }}
                      />
                      <div>
                        <h3>{p.original}</h3>
                        <span>{p.initial}</span>
                      </div>
                      <button type="button" className="state-link" onClick={() => setSelectedPersona(p.underscore)}>
                        State
                      </button>
                    </div>
                    <dl className="persona-facts">
                      <div>
                        <dt>Action</dt>
                        <dd>{summary.action}</dd>
                      </div>
                      <div>
                        <dt>Location</dt>
                        <dd>{summary.location}</dd>
                      </div>
                      <div>
                        <dt>Conversation</dt>
                        <dd>{summary.chatText}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        </aside>
      </main>

      {selectedPersona && (
        <PersonaStatePage
          simCode={demo.sim_code}
          step={currentStep}
          personaName={selectedPersona}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}
