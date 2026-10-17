import type { TaskKind } from "./types";

export const taskGuidance: Record<
  TaskKind,
  { action: string; evidence: string; reminder: string }
> = {
  revisao_cadastral: {
    action:
      "Descreva a conferência e a correção cadastral registrada, sem informar dados pessoais.",
    evidence:
      "Informe o protocolo ou registro que comprova a correção cadastral.",
    reminder:
      "Conferir o cadastro não basta: confirme a correção que resolveu a divergência antes de encerrar.",
  },
  investigacao_logistica: {
    action:
      "Descreva a verificação com a transportadora e o encaminhamento realizado.",
    evidence:
      "Informe o protocolo da transportadora ou a referência do rastreamento consultado.",
    reminder:
      "Abrir um chamado ou localizar o pedido não encerra a exceção. Aguarde entrega confirmada ou outra solução comprovada.",
  },
  revisao_separacao: {
    action:
      "Descreva a conferência da separação e a ação tomada para tratar o item faltante.",
    evidence:
      "Informe a referência da conferência, da expedição ou do registro do CD.",
    reminder:
      "Identificar a falta ou separar outro item não comprova a solução para o cliente. Se houver reenvio, confirme o recebimento.",
  },
  inspecao_lote: {
    action:
      "Descreva o que a inspeção identificou e a tratativa realizada para este pedido.",
    evidence:
      "Informe a referência da inspeção ou do registro de qualidade, sem dados pessoais.",
    reminder:
      "Inspecionar o lote não resolve automaticamente o pedido. Registre a solução individual e sua confirmação.",
  },
  manutencao_personalizacao: {
    action:
      "Descreva a verificação da personalização e a correção ou reprodução realizada para este pedido.",
    evidence:
      "Informe a ordem de produção, inspeção ou referência que comprova a ação.",
    reminder:
      "Consertar a máquina ou reproduzir o item não comprova que o cliente recebeu a solução. Acompanhe o resultado individual.",
  },
  revisao_status: {
    action:
      "Confira a fonte e registre a revisão no formulário de status do pedido.",
    evidence:
      "Informe a referência usada para decidir qual status está correto.",
    reminder:
      "Validar o status corrige a leitura dos dados; não comprova a resolução da exceção.",
  },
  revisao_pagamento: {
    action:
      "Descreva a conferência e a regularização realizada no sistema de pagamento.",
    evidence:
      "Informe o identificador do registro financeiro ou protocolo consultado, sem dados de cartão.",
    reminder:
      "Solicitar uma verificação não significa pagamento regularizado. Encerre apenas após confirmar o resultado.",
  },
  revisao_estoque: {
    action:
      "Descreva a conferência de estoque e a ação realizada para atender este pedido.",
    evidence:
      "Informe a referência da reserva, movimentação ou regularização no sistema.",
    reminder:
      "Consultar disponibilidade não basta. Confirme a regularização do atendimento ou outra solução efetiva.",
  },
  proposta_reenvio: {
    action:
      "Descreva qual item foi reenviado e o despacho realizado. Se já recebido, inclua a confirmação.",
    evidence:
      "Informe a referência da expedição ou rastreio; se recebido, indique o comprovante de recebimento.",
    reminder:
      "Aprovar não envia o produto. Despachar mantém o pedido aberto; o encerramento exige confirmação de recebimento e solução da pendência.",
  },
  proposta_reembolso: {
    action:
      "Descreva o reembolso efetivamente registrado no sistema financeiro, sem dados bancários pessoais.",
    evidence:
      "Informe a referência do comprovante ou registro financeiro que confirma o reembolso.",
    reminder:
      "Aprovar não movimenta dinheiro. Uma solicitação ainda pendente não comprova reembolso; registre o valor efetivo no resultado.",
  },
  melhoria_processo: {
    action:
      "Descreva as verificações realizadas no grupo de pedidos e suas conclusões.",
    evidence:
      "Selecione os pedidos conferidos e informe referências verificáveis.",
    reminder:
      "Uma investigação de processo não encerra pedidos em lote nem comprova que a melhoria foi implantada.",
  },
};
