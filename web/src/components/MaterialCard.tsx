import type { MaterialRef } from "../data/materials";

export function MaterialCard({ material }: { material: MaterialRef }) {
  return (
    <a className="material-embed" href={material.buyUrl} target="_blank" rel="noreferrer">
      <div className="material-embed-img">
        <img src={material.image} alt={material.name} loading="lazy" />
      </div>
      <div className="material-embed-body">
        <div className="material-embed-brand">{material.brand}</div>
        <div className="material-embed-name">{material.name}</div>
        <div className="material-embed-desc">{material.description}</div>
        <div className="material-embed-link">voolt3d.com.br ↗</div>
      </div>
    </a>
  );
}
