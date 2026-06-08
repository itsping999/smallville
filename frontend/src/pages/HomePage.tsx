import { useEffect, useState, useCallback } from "react";
import PhaserGame from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { SimStatus, MovementData, DemoSummary } from "../api";
import { fetchSimStatus, sendEnvironment, fetchMovement, fetchDemos } from "../api";

interface PersonaState {
  description: string;
  chat: [string, string][] | null;
}

export default function HomePage() {
  const [sim, setSim] = useState<SimStatus | null>(null);
  const [time, setTime] = useState("");
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [error, setError] = useState("");
  const [demos, setDemos] = useState<DemoSummary[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

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
    initPos[p.name.replace(" ", "_")] = [p.x, p.y];
  }

  return (
    <div className="page">
      <PhaserGame
        mode="simulate"
        simCode={sim.sim_code}
        step={sim.step}
        personaInitPos={initPos}
        onTimeUpdate={onTimeUpdate}
        onPersonaUpdate={onPersonaUpdate}
        sendEnvironment={doSendEnv}
        fetchMovement={doFetchMovement}
      />

      <div className="info-panel">
        <div className="time-display">
          <h3>Current Time</h3>
          <h2>{time || "Waiting for first step..."}</h2>
        </div>

        {sim.persona_names.map((p) => {
          const st = personaStates[p.original];
          const action = st?.description?.split("@")[0] || "";
          const location = st?.description?.split("@")[1] || "";
          const chatText = st?.chat
            ? st.chat.map(([who, msg]) => `${who}: ${msg}`).join("\n")
            : "None at the moment";

          return (
            <div key={p.underscore} className="persona-card">
              <div className="persona-avatar">
                <img src="/static/img/atlas.png" alt={p.original} />
              </div>
              <div className="persona-info">
                <h2>
                  {p.original}{" "}
                  <a href="#" className="state-link" onClick={(e) => { e.preventDefault(); setSelectedPersona(p.underscore); }}>
                    State Details
                  </a>
                </h2>
                <p><strong>Current Action:</strong><br />{action}</p>
                <p><strong>Location:</strong><br />{location}</p>
                <p><strong>Conversation:</strong><br />{chatText}</p>
              </div>
            </div>
          );
        })}
      </div>

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
