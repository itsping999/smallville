import { useEffect, useState, useCallback, useRef } from "react";
import PhaserGame from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { SimStatus, MovementData, DemoSummary } from "../api";
import { fetchSimStatus, sendEnvironment, fetchMovement, fetchDemos, stopSimulation } from "../api";

interface PersonaState {
  description: string;
  chat: [string, string][] | null;
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

function summarizeState(state?: PersonaState) {
  const [rawAction = "", ...locationParts] = (state?.description || "").split("@");
  const action = rawAction.trim() || "Waiting for the next live update";
  const location = locationParts.join("@").trim() || "Location not reported yet";
  const chatText = state?.chat?.length
    ? state.chat.map(([who, msg]) => `${who}: ${msg}`).join("\n")
    : "No active conversation";

  return { action, location, chatText };
}

export default function HomePage() {
  const [sim, setSim] = useState<SimStatus | null>(null);
  const [time, setTime] = useState("");
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [error, setError] = useState("");
  const [demos, setDemos] = useState<DemoSummary[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [waitingStep, setWaitingStep] = useState<number | null>(null);
  const [liveStep, setLiveStep] = useState<number | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isStopped, setIsStopped] = useState(false);

  const handleStopLive = async () => {
    try {
      setIsStopping(true);
      await stopSimulation();
      setIsStopped(true);
    } catch (e: any) {
      alert(`停止模拟失败: ${e.message}`);
    } finally {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    document.title = "Smallville · Live Simulation";
    fetchSimStatus()
      .then(setSim)
      .catch((e) => {
        setError(e.message);
        fetchDemos().then(setDemos).catch(() => {});
      });
  }, []);

  const onTimeUpdate = useCallback((t: string) => setTime(t), []);
  const onLiveStepChange = useCallback((step: number) => setLiveStep(step), []);
  const onPersonaUpdate = useCallback((name: string, data: any) => {
    setWaitingStep(null);
    setPersonaStates((prev) => ({
      ...prev,
      [name]: { description: data.description || "", chat: data.chat || null },
    }));
  }, []);

  const doSendEnv = useCallback(
    (step: number, env: Record<string, { maze: string; x: number; y: number }>) =>
      sendEnvironment({ step, sim_code: sim!.sim_code, environment: env }),
    [sim]
  );

  const doFetchMovement = useCallback(
    (step: number): Promise<MovementData> => fetchMovement(step, sim!.sim_code),
    [sim]
  );

  if (error) {
    const demo = demos[0];
    return (
      <div className="error-page">
        <h2>未检测到正在运行的实时模拟</h2>
        <p>当前没有在运行中的实时仿真线程。您可以在存档中心选择一个世界模板进行实时计算，或体验离线演示。</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px" }}>
          <a className="primary-link" href="/">
            ← 返回存档中心
          </a>
          {demo && (
            <a className="primary-link" href={`/demo/${demo.sim_code}/${demo.default_step}`}>
              🎬 体验离线演示
            </a>
          )}
        </div>
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  if (!sim) return <div className="loading">Loading simulation...</div>;

  const displayStep = liveStep ?? sim.step;
  const initPos: Record<string, [number, number]> = {};
  for (const p of sim.persona_init_pos) {
    initPos[personaKey(p.name)] = [p.x, p.y];
  }
  const displayTime = time || "Waiting for first step...";
  const liveStatus = isStopped ? "Stopped" : waitingStep ? `Waiting for step ${waitingStep}` : "Live";
  const handoffStatus = isStopped ? "Stopped" : waitingStep ? "Waiting for Reverie" : "Live handoff";
  const latestStates = sim.persona_names.map((p) => ({
    ...p,
    state: personaStates[p.underscore] ?? personaStates[p.original],
    avatar: `/static/assets/characters/profile/${p.underscore}.png`,
  }));

  return (
    <div className="page workspace-page compact-viewport">
      <header className="workspace-header">
        <div className="workspace-header-left">
          <a href="/" className="back-link">
            ← Back to saves
          </a>
          <span className="mode-pill live">Live simulation</span>
          <h1>Smallville</h1>
          <span className="header-sub-tag">{sim.sim_code.replace(/_/g, " ")}</span>
        </div>

        <div className="workspace-header-center">
          <span className={isStopped ? "window-status waiting" : waitingStep ? "window-status waiting" : "window-status live"}>
            {liveStatus}
          </span>
          <div className="header-time-pill" title="Live world time">
            <span className="time-clock-icon">🕒</span>
            <span className="time-value">{displayTime}</span>
          </div>
        </div>

        <div className="workspace-header-right">
          <span className="stat-pill stat-pill--villagers">
            <strong>{sim.persona_names.length}</strong> Villagers
          </span>
          <span className="stat-pill stat-pill--step">
            Step <strong>{displayStep}</strong>
          </span>
          <span className="stat-pill stat-pill--handoff">
            Handoff <strong>{handoffStatus}</strong>
          </span>
          <button
            type="button"
            className="btn-stop-live-header"
            onClick={handleStopLive}
            disabled={isStopping || isStopped}
            title="停止后台实时推演"
          >
            {isStopping ? "停止中..." : isStopped ? "已停止" : "⏹️ 停止模拟"}
          </button>
        </div>
      </header>

      <main className="workspace-center-stage">
        <section className="map-window-centered" aria-label="Town map">
          <PhaserGame
            mode="simulate"
            simCode={sim.sim_code}
            step={sim.step}
            personaInitPos={initPos}
            onTimeUpdate={onTimeUpdate}
            onPersonaUpdate={onPersonaUpdate}
            onStepChange={onLiveStepChange}
            onWaitingForMovement={setWaitingStep}
            sendEnvironment={doSendEnv}
            fetchMovement={doFetchMovement}
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
                onClick={() => setSelectedPersona(p.underscore)}
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

      {selectedPersona && sim && (
        <PersonaStatePage
          simCode={sim.sim_code}
          step={displayStep}
          personaName={selectedPersona}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}
