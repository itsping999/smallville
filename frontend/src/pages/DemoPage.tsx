import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import PhaserGame, { type PhaserGameHandle } from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { DemoData } from "../api";
import { fetchDemoData, startSimulation } from "../api";

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
interface RosterPersona {
  original: string;
  underscore: string;
  initial: string;
  state?: PersonaState;
  avatar: string;
}
interface HoverTarget {
  persona: RosterPersona;
  top: number;
  centerX: number;
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
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const phaserGameRef = useRef<PhaserGameHandle>(null);
  const [currentStep, setCurrentStep] = useState(step);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState<number>(2);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isStartingLive, setIsStartingLive] = useState(false);
  const wasPlayingRef = useRef(false);

  const handleStartLiveFromDemo = async () => {
    if (!demo) return;
    try {
      setIsStartingLive(true);
      await startSimulation(demo.sim_code, demo.sim_code);
      setTimeout(() => {
        window.location.href = "/live";
      }, 400);
    } catch (e: any) {
      alert(`启动实时模拟失败: ${e.message}`);
      setIsStartingLive(false);
    }
  };

  useEffect(() => {
    fetchDemoData(simCode, step)
      .then((data) => {
        setDemo(data);
        document.title = `Smallville · ${data.sim_code.replace(/_/g, " ")}`;
        if (data.play_speed) {
          setPlaySpeed(data.play_speed);
        }
      })
      .catch((e) => setError(e.message));
  }, [simCode, step]);

  useEffect(() => {
    setCurrentStep(step);
    setPersonaStates({});
    setSelectedPersona(null);
    setHoverTarget(null);
    setIsPlaying(true);
    setIsScrubbing(false);
  }, [simCode, step]);

  const onPersonaUpdate = useCallback((name: string, data: any) => {
    setPersonaStates((prev) => ({
      ...prev,
      [name]: { description: data.description || "", chat: data.chat || null },
    }));
  }, []);

  const onStepChange = useCallback(
    (s: number) => {
      if (!isScrubbing) {
        setCurrentStep(s);
      }
    },
    [isScrubbing],
  );

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

  const seekToFrame = useCallback(
    (index: number) => {
      if (index < 0 || index >= movementSteps.length) return;
      const targetStep = movementSteps[index];
      setCurrentStep(targetStep);
      phaserGameRef.current?.seekTo(targetStep);
    },
    [movementSteps],
  );

  const handleScrubStart = useCallback(() => {
    wasPlayingRef.current = isPlaying;
    setIsPlaying(false);
    setIsScrubbing(true);
  }, [isPlaying]);

  const handleScrubChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const index = Number(e.target.value);
      seekToFrame(index);
    },
    [seekToFrame],
  );

  const handleScrubEnd = useCallback(() => {
    setIsScrubbing((was) => {
      if (was && wasPlayingRef.current) {
        setIsPlaying(true);
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (!isScrubbing) return;
    const onGlobalRelease = () => {
      handleScrubEnd();
    };
    window.addEventListener("pointerup", onGlobalRelease);
    window.addEventListener("mouseup", onGlobalRelease);
    window.addEventListener("touchend", onGlobalRelease);
    return () => {
      window.removeEventListener("pointerup", onGlobalRelease);
      window.removeEventListener("mouseup", onGlobalRelease);
      window.removeEventListener("touchend", onGlobalRelease);
    };
  }, [isScrubbing, handleScrubEnd]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const nextPlaying = !prev;
      if (nextPlaying && movementSteps.length > 0 && currentStep >= (movementSteps[movementSteps.length - 1] ?? currentStep)) {
        seekToFrame(0);
      }
      return nextPlaying;
    });
  }, [currentStep, movementSteps, seekToFrame]);

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

  const currentFrameIndex = replayStats.currentFrame > 0 ? replayStats.currentFrame - 1 : 0;

  return (
    <div className="page workspace-page compact-viewport">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <a href="/" className="back-link">
            ← Back to saves
          </a>
          <span className="mode-pill">Replay demo</span>
          <h1>Smallville</h1>
          <span className="header-sub-tag">{demo.sim_code.replace(/_/g, " ")}</span>
        </div>

        <div className="workspace-header-center">
          <button
            type="button"
            className="icon-control"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
            title={isPlaying ? "Pause replay" : "Play replay"}
          >
            <span className={isPlaying ? "pause-icon" : "play-icon"} aria-hidden="true" />
          </button>
          <div className="header-time-pill" title={`Started ${dateStr} · Speed x${playSpeed}`}>
            <span className="time-clock-icon">🕒</span>
            <span className="time-value">{displayTime}</span>
          </div>
          <div
            className="header-progress-wrap"
            title={`Recorded frame ${replayStats.currentFrame} / ${replayStats.totalFrames} · Step ${currentStep} (${replayStats.firstStep}-${replayStats.lastStep}) · Drag slider to scrub`}
          >
            <div className="header-slider-track-wrap">
              <div className="header-progress-bar-bg" />
              <div className="header-progress-bar-fill" style={{ width: `${replayStats.percent}%` }} />
              <input
                type="range"
                className="header-progress-slider"
                min={0}
                max={Math.max(0, replayStats.totalFrames - 1)}
                value={currentFrameIndex}
                onPointerDown={handleScrubStart}
                onMouseDown={handleScrubStart}
                onTouchStart={handleScrubStart}
                onChange={handleScrubChange}
                onPointerUp={handleScrubEnd}
                onMouseUp={handleScrubEnd}
                onTouchEnd={handleScrubEnd}
                aria-label="Replay progress scrubber"
              />
            </div>
            <span className="header-progress-text">
              {replayStats.currentFrame}/{replayStats.totalFrames}
            </span>
          </div>
        </div>

        <div className="workspace-header-right">
          <button
            type="button"
            className="live-switch-pill"
            onClick={handleStartLiveFromDemo}
            disabled={isStartingLive}
            title="以此演示存档启动实时计算仿真"
          >
            {isStartingLive ? "启动中..." : "⚡️ 转为实时模拟"}
          </button>
          <span className="stat-pill stat-pill--villagers">
            <strong>{demo.persona_names.length}</strong> Villagers
          </span>
          <span className="stat-pill stat-pill--step">
            Step <strong>{currentStep}</strong>
          </span>
          <div className="speed-control-pill" title="Playback speed">
            <span className="speed-icon">⚡</span>
            <span className="speed-label">Speed</span>
            <select
              className="speed-select"
              value={playSpeed}
              onChange={(e) => setPlaySpeed(Number(e.target.value))}
              aria-label="Playback speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1.0x</option>
              <option value={2}>2.0x</option>
              <option value={4}>4.0x</option>
              <option value={8}>8.0x</option>
            </select>
          </div>
        </div>
      </header>

      <main className="workspace-center-stage">
        <section className="map-window-centered" aria-label="Town map">
          <PhaserGame
            ref={phaserGameRef}
            mode="demo"
            simCode={demo.sim_code}
            step={step}
            personaInitPos={demo.persona_init_pos}
            allMovement={movement}
            playSpeed={playSpeed}
            isPlaying={isPlaying}
            onPersonaUpdate={onPersonaUpdate}
            onStepChange={onStepChange}
          />
        </section>
      </main>

      <footer className="roster-bottom-dock" aria-label="Town Villagers">
        <div className="dock-title-tag">
          <span className="dock-icon">👥</span>
          <span className="dock-name">Villagers</span>
          <span className="dock-badge">{latestStates.length}</span>
        </div>
        <div className="dock-roster-items">
          {latestStates.map((p) => {
            const summary = summarizeState(p.state);
            const isHovered = hoverTarget?.persona.underscore === p.underscore;

            return (
              <div
                key={p.underscore}
                className={`dock-persona-card ${isHovered ? "active" : ""}`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (hideTimerRef.current) {
                    window.clearTimeout(hideTimerRef.current);
                    hideTimerRef.current = null;
                  }
                  setHoverTarget({
                    persona: p,
                    top: rect.top,
                    centerX: rect.left + rect.width / 2,
                  });
                }}
                onMouseLeave={() => {
                  hideTimerRef.current = window.setTimeout(() => {
                    setHoverTarget(null);
                  }, 120);
                }}
                onClick={() => {
                  setSelectedPersona(p.underscore);
                  phaserGameRef.current?.focusPersona?.(p.underscore);
                }}
                title="Hover for details, click for cognitive state"
              >
                <div className="dock-avatar-wrap">
                  <img
                    src={p.avatar}
                    alt={p.original}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/static/img/atlas.png";
                    }}
                  />
                  <span className="dock-initials">{p.initial}</span>
                </div>
                <div className="dock-persona-info">
                  <span className="dock-persona-name">{p.original}</span>
                  <span className="dock-persona-location">
                    {summary.location !== "Location not reported yet"
                      ? `📍 ${summary.location}`
                      : "📍 In town"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </footer>

      {hoverTarget && (
        <div
          className="roster-floating-card bottom-dock-mode"
          style={{
            position: "fixed",
            bottom: window.innerHeight - hoverTarget.top + 10,
            left: Math.max(16, Math.min(window.innerWidth - 376, hoverTarget.centerX - 180)),
            zIndex: 9999,
          }}
          onMouseEnter={() => {
            if (hideTimerRef.current) {
              window.clearTimeout(hideTimerRef.current);
              hideTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            setHoverTarget(null);
          }}
        >
          {(() => {
            const summary = summarizeState(hoverTarget.persona.state);
            return (
              <>
                <div className="popover-header">
                  <img
                    src={hoverTarget.persona.avatar}
                    alt={hoverTarget.persona.original}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/static/img/atlas.png";
                    }}
                  />
                  <div>
                    <h4>{hoverTarget.persona.original}</h4>
                    <span className="popover-badge">{hoverTarget.persona.initial}</span>
                  </div>
                  <button
                    type="button"
                    className="state-link"
                    onClick={() => {
                      setSelectedPersona(hoverTarget.persona.underscore);
                      phaserGameRef.current?.focusPersona?.(hoverTarget.persona.underscore);
                      setHoverTarget(null);
                    }}
                  >
                    State →
                  </button>
                </div>
                <div className="popover-body">
                  <div className="popover-field">
                    <span className="field-label">Current Action</span>
                    <p className="field-value action-value">{summary.action}</p>
                  </div>
                  <div className="popover-field">
                    <span className="field-label">Location</span>
                    <p className="field-value location-value">{summary.location}</p>
                  </div>
                  <div className="popover-field">
                    <span className="field-label">Conversation</span>
                    <p className="field-value chat-value">{summary.chatText}</p>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

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
