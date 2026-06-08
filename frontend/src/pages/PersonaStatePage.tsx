import { useEffect, useState } from "react";

interface Props {
  simCode: string;
  step: number;
  personaName: string;
  onClose: () => void;
}

interface PersonaData {
  persona_name: string;
  scratch: Record<string, any>;
  spatial: Record<string, any>;
  a_mem_event: any[];
  a_mem_chat: any[];
  a_mem_thought: any[];
}

export default function PersonaStatePage({ simCode, step, personaName, onClose }: Props) {
  const [data, setData] = useState<PersonaData | null>(null);

  useEffect(() => {
    fetch(`/api/persona/${simCode}/${step}/${personaName}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [simCode, step, personaName]);

  if (!data) return <div className="loading">Loading persona state...</div>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>{data.persona_name} — State Details</h2>

        <h3>Scratch</h3>
        <pre className="state-block">{JSON.stringify(data.scratch, null, 2)}</pre>

        <h3>Spatial Memory</h3>
        <pre className="state-block">{JSON.stringify(data.spatial, null, 2)}</pre>

        <h3>Recent Events ({data.a_mem_event.length})</h3>
        <div className="mem-list">
          {data.a_mem_event.slice(0, 20).map((e, i) => (
            <div key={i} className="mem-item">
              <strong>{e.created || ""}</strong>: {e.description || e.content || JSON.stringify(e)}
            </div>
          ))}
        </div>

        <h3>Recent Thoughts ({data.a_mem_thought.length})</h3>
        <div className="mem-list">
          {data.a_mem_thought.slice(0, 20).map((t, i) => (
            <div key={i} className="mem-item">
              <strong>{t.created || ""}</strong>: {t.description || t.content || JSON.stringify(t)}
            </div>
          ))}
        </div>

        <h3>Recent Chats ({data.a_mem_chat.length})</h3>
        <div className="mem-list">
          {data.a_mem_chat.slice(0, 20).map((c, i) => (
            <div key={i} className="mem-item">
              <strong>{c.created || ""}</strong>: {c.description || c.content || JSON.stringify(c)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
