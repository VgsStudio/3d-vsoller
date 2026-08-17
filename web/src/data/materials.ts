export interface MaterialRef {
  id: string;
  name: string;
  description: string;
  buyUrl: string;
}

export const MATERIALS: MaterialRef[] = [
  {
    id: "pla-voolt3d-branco",
    name: "PLA Voolt3D — Branco",
    description: "Filamento padrão pra peças do dia a dia: chaveiros, brindes, protótipos. Fácil de imprimir, sem cheiro forte.",
    buyUrl: "https://voolt3d.com.br/produtos/filamento-pla-branco-dental-premium/",
  },
  {
    id: "petg-voolt3d-preto",
    name: "PETG Voolt3D — Preto (High Fluidity)",
    description: "Pra peças que precisam de mais resistência mecânica e térmica — suportes, encaixes, uso ao ar livre.",
    buyUrl: "https://voolt3d.com.br/produtos/filamento-petg-hf-preto-high-fluidity-premium-1kg/",
  },
];

export function materialRefFor(material?: string): MaterialRef | undefined {
  if (!material) return undefined;
  const normalized = material.toLowerCase();
  return MATERIALS.find((m) => normalized.includes(m.name.split(" ")[0].toLowerCase()));
}
