import { useEffect, useState, useCallback } from "react";
import PhaserGame from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { SimStatus, MovementData, DemoSummary } from "../api";
import { fetchSimStatus, sendEnvironment, fetchMovement, fetchDemos } from "../api";

interface PersonaState {
  description: string;
  chat: [string, string][] | null;
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
  const [waitingStep, setWaitingStep] = useState<number | null>(null);

  useEffect(() => {
    fetchSimStatus()
      .then(setSim)
      .catch((e) => {
        setError(e.message);
        fetchDemos().then(setDemos).catch(() => {});
      });
  }, []);

  const onTimeUpdate = useCallback((t: string) => setTime(t), []);
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
        <h2>No live simulation is running</h2>
        <p>For a live run, start the Reverie CLI with <code>cd reverie/backend_server && python reverie.py</code>.</p>
        {demo && (
          <a className="primary-link" href={`/demo/${demo.sim_code}/${demo.default_step}`}>
            Open bundled demo
          </a>
        )}
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  if (!sim) return <div className="loading">Loading simulation...</div>;

  const initPos: Record<string, [number, number]> = {};
  for (const p of sim.persona_init_pos) {
    initPos[personaKey(p.name)] = [p.x, p.y];
  }
  const displayTime = time || "Waiting for first step...";
  const liveStatus = waitingStep ? `Waiting for step ${waitingStep}` : "Live";
  const handoffStatus = waitingStep ? "Waiting for Reverie" : "Live handoff";
  const latestStates = sim.persona_names.map((p) => ({
    ...p,
    state: personaStates[p.underscore] ?? personaStates[p.original],
    avatar: `/static/assets/characters/profile/${p.underscore}.png`,
  }));

  return (
    <div className="page workspace-page">
      <header className="workspace-header">
        <div className="workspace-title">
          <span className="mode-pill live">Live simulation</span>
          <h1>Smallville Observation Desk</h1>
          <p>{sim.sim_code.replace(/_/g, " ")}</p>
        </div>
        <div className="workspace-stats" aria-label="Simulation status">
          <div>
            <span>Agents</span>
            <strong>{sim.persona_names.length}</strong>
          </div>
          <div>
            <span>Step</span>
            <strong>{sim.step}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{liveStatus}</strong>
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
            <span className={waitingStep ? "window-status waiting" : "window-status live"}>
              {handoffStatus}
            </span>
          </div>
          <PhaserGame
            mode="simulate"
            simCode={sim.sim_code}
            step={sim.step}
            personaInitPos={initPos}
            onTimeUpdate={onTimeUpdate}
            onPersonaUpdate={onPersonaUpdate}
            onWaitingForMovement={setWaitingStep}
            sendEnvironment={doSendEnv}
            fetchMovement={doFetchMovement}
          />
        </section>

        <aside className="info-panel" aria-label="Simulation details">
          <section className="side-section">
            <span className="section-kicker">Current time</span>
            <h2>{displayTime}</h2>
            <div className="time-meta">
              <span>Simulation {sim.sim_code}</span>
              <span>Step {sim.step}</span>
              {waitingStep && <span>Waiting for movement/{waitingStep}.json</span>}
            </div>
          </section>

          <section className="side-section">
            <div className="section-heading">
              <span className="section-kicker">Roster</span>
              <span>{sim.persona_names.length} active</span>
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
              <span>Live</span>
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

      {selectedPersona && sim && (
        <PersonaStatePage
          simCode={sim.sim_code}
          step={sim.step}
          personaName={selectedPersona}
          onClose={() => setSelectedPersona(null)}
        />
      )}
    </div>
  );
}
