import { MATERIALS } from "../data/materials";

export function MaterialsSection() {
  return (
    <div className="materials-section">
      <h2>Materiais usados</h2>
      <div className="materials-grid">
        {MATERIALS.map((m) => (
          <div className="material-card" key={m.id}>
            <div className="name">{m.name}</div>
            <div className="desc">{m.description}</div>
            <a href={m.buyUrl} target="_blank" rel="noreferrer">
              onde comprar ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
