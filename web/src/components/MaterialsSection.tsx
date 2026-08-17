import { MATERIALS } from "../data/materials";
import { MaterialCard } from "./MaterialCard";

export function MaterialsSection() {
  return (
    <div className="materials-grid materials-grid-standalone">
      {MATERIALS.map((m) => (
        <MaterialCard material={m} key={m.id} />
      ))}
    </div>
  );
}
