export interface MaterialRef {
  id: string;
  name: string;
  description: string;
  buyUrl: string;
  image: string;
  brand: string;
}

export const MATERIALS: MaterialRef[] = [
  {
    id: "pla-voolt3d-branco",
    name: "PLA Branco",
    brand: "Voolt3D",
    description: "Filamento padrão pra peças do dia a dia: chaveiros, brindes, protótipos. Fácil de imprimir, sem cheiro forte.",
    buyUrl: "https://voolt3d.com.br/produtos/filamento-pla-branco-dental-premium/",
    image: "https://acdn-us.mitiendanube.com/stores/005/959/122/products/branco-dentalpeca-8e5894482f0cf67d1f17466440128652-1024-1024.webp",
  },
  {
    id: "petg-voolt3d-preto",
    name: "PETG Preto (High Fluidity)",
    brand: "Voolt3D",
    description: "Pra peças que precisam de mais resistência mecânica e térmica — suportes, encaixes, uso ao ar livre.",
    buyUrl: "https://voolt3d.com.br/produtos/filamento-petg-hf-preto-high-fluidity-premium-1kg/",
    image: "https://acdn-us.mitiendanube.com/stores/005/959/122/products/preto-petg-lp-a03a8d9778506d8b7317603838833701-1024-1024.webp",
  },
];

export function materialRefFor(material?: string): MaterialRef | undefined {
  if (!material) return undefined;
  const normalized = material.toLowerCase();
  return MATERIALS.find((m) => normalized.includes(m.name.split(" ")[0].toLowerCase()));
}
