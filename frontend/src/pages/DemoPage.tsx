import { useEffect, useState, useCallback } from "react";
import PhaserGame from "../components/PhaserGame";
import PersonaStatePage from "./PersonaStatePage";
import type { DemoData } from "../api";
import { fetchDemoData } from "../api";

interface Props { simCode: string; step: number; }
interface PersonaState { description: string; chat: [string, string][] | null; }

export default function DemoPage({ simCode, step }: Props) {
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [time, setTime] = useState("");
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const [error, setError] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(step);

  useEffect(() => {
    fetchDemoData(simCode, step).then(setDemo).catch((e) => setError(e.message));
  }, [simCode, step]);

  const onTimeUpdate = useCallback((t: string) => setTime(t), []);
  const onPersonaUpdate = useCallback((name: string, data: any) => {
    setPersonaStates((prev) => ({
      ...prev,
      [name]: { description: data.description || "", chat: data.chat || null },
    }));
  }, []);
  const onStepChange = useCallback((s: number) => setCurrentStep(s), []);

  if (error) {
    return (
      <div className="error-page">
        <h2>Demo not found</h2>
        <p>Simulation "{simCode}" at step {step} could not be loaded.</p>
      </div>
    );
  }

  if (!demo) return <div className="loading">Loading demo...</div>;

  const movement: Record<string, any> = {};
  for (const [k, v] of Object.entries(demo.all_movement)) {
    movement[String(k)] = v;
  }

  const startDate = new Date(demo.start_datetime);
  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = startDate.toLocaleTimeString("en-US");

  return (
    <div className="page">
      <div className="demo-banner">
        <em>Pre-computed replay — "Generative Agents: Interactive Simulacra of Human Behavior"</em>
      </div>

      <PhaserGame
        mode="demo"
        simCode={demo.sim_code}
        step={demo.step}
        personaInitPos={demo.persona_init_pos}
        allMovement={movement}
        playSpeed={demo.play_speed}
        onTimeUpdate={onTimeUpdate}
        onPersonaUpdate={onPersonaUpdate}
        onStepChange={onStepChange}
      />

      <div className="info-panel">
        <div className="time-display">
          <h3>Current Time</h3>
          <h2>{time || `${dateStr} ${timeStr}`}</h2>
        </div>

        <div className="persona-grid">
          {demo.persona_names.map((p) => (
            <div key={p.underscore} className="persona-chip">
              <img
                src={`/static/assets/characters/profile/${p.underscore}.png`}
                alt={p.original}
                onError={(e) => { (e.target as HTMLImageElement).src = "/static/img/atlas.png"; }}
              />
              <span className="initial">{p.initial}</span>
            </div>
          ))}
        </div>

        {demo.persona_names.map((p) => {
          const st = personaStates[p.original];
          const action = st?.description?.split("@")[0] || "";
          const location = st?.description?.split("@")[1] || "";
          const chatText = st?.chat
            ? st.chat.map(([who, msg]) => `${who}: ${msg}`).join("\n")
            : "None at the moment";

          return (
            <div key={p.underscore} className="persona-card">
              <div className="persona-avatar">
                <img
                  src={`/static/assets/characters/profile/${p.underscore}.png`}
                  alt={p.original}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/static/img/atlas.png"; }}
                />
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
