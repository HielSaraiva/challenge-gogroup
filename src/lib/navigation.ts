export const nav = [
  ["overview", "Hoje"],
  ["queue", "Pedidos"],
  ["agent", "Pendências"],
  ["impact", "Resultados"],
  ["insights", "Recorrências"],
  ["data", "Dados"],
  ["method", "Metodologia"],
] as const;

export type Tab = (typeof nav)[number][0];

export const pageTitles: Record<Tab, string> = {
  overview: "Prepare seu dia com o agente",
  queue: "Pedidos para acompanhar",
  agent: "Pendências da equipe",
  impact: "Resultados da operação",
  insights: "Recorrências para investigar",
  data: "Dados da operação",
  method: "Metodologia da operação",
};
export const pageDescriptions: Record<Tab, string> = {
  overview:
    "Escolha o foco do dia. A IA compara alternativas e prepara um plano para a equipe.",
  queue: "Consulte a carteira recebida ou siga o plano preparado pelo agente.",
  agent: "Revise propostas, registre execuções e documente investigações.",
  impact:
    "Veja pedidos abertos e resolvidos, tipos de solução e valores registrados.",
  insights:
    "Identifique problemas repetidos e investigue possíveis causas na operação.",
  data: "Valide os arquivos, confira a origem e gerencie sua demonstração.",
  method: "Entenda o fluxo e os motivos das decisões de negócio e tecnologia.",
};
