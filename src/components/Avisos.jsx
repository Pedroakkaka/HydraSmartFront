import { useAvisos } from '../store/useTelemetria.js';

export default function Avisos() {
  const avisos = useAvisos((s) => s.avisos);
  const remover = useAvisos((s) => s.remover);

  return (
    <div className="avisos-container" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso ${a.tipo}`} onClick={() => remover(a.id)}>
          {a.texto}
        </div>
      ))}
    </div>
  );
}
