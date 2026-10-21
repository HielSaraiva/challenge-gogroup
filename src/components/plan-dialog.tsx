"use client";
import type { WorkspaceSnapshot } from "@/domain/workspace";
import { CAPACITY, STRATEGIES, type Strategy } from "@/domain/types";
import { Bot } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

type PlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: WorkspaceSnapshot["day"] | undefined;
  orderCount: number | undefined;
  strategy: Strategy;
  onStrategyChange: (strategy: Strategy) => void;
  busy: boolean;
  onPrepare: () => void;
  onCloseAutoFocus: (event: Event) => void;
};
export function PlanDialog({
  open,
  onOpenChange,
  day,
  orderCount,
  strategy,
  onStrategyChange,
  busy,
  onPrepare,
  onCloseAutoFocus,
}: PlanDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="confirmation-dialog"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <span className="new-plan-icon" aria-hidden="true">
          <Bot size={24} />
        </span>
        <DialogTitle>
          {day?.plan ? "Preparar um novo plano" : "Preparar meu dia com IA"}
        </DialogTitle>
        <DialogDescription>
          Escolha o foco da equipe. A IA comparará as alternativas, aplicará sua
          escolha e preparará os encaminhamentos.
        </DialogDescription>
        <div className="plan-capacity-note">
          <strong>
            Até {Math.min(orderCount || 0, day?.availableCapacity || 0)} pedidos
            neste plano
          </strong>
          <p>
            {day?.availableCapacity || 0} de {day?.capacity || CAPACITY} vagas
            de referência disponíveis. Cada encerramento registrado conta como
            uma tratativa no piloto.
          </p>
        </div>
        <fieldset className="plan-strategies">
          <legend>Qual é o foco para este plano?</legend>
          {(
            Object.entries(STRATEGIES) as [
              Strategy,
              (typeof STRATEGIES)[Strategy],
            ][]
          ).map(([id, option]) => (
            <label className="plan-strategy" key={id}>
              <input
                type="radio"
                name="plan-strategy"
                value={id}
                checked={strategy === id}
                onChange={() => onStrategyChange(id)}
              />
              <span>
                <strong>{option.label}</strong>
                <span>
                  {id === "equilibrada"
                    ? "Equilibra valor dos pedidos, tempo de espera e histórico do cliente."
                    : id === "urgencia"
                      ? "Dá mais peso ao tempo de espera e aos atrasos."
                      : "Dá mais peso ao histórico do cliente e ao potencial de relacionamento."}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {day?.plan && (
          <div className="new-plan-consequences">
            <div>
              <strong>O novo plano passa a ser o ativo</strong>
              <p>
                O plano anterior será preservado nos registros da sessão. A tela
                mostrará o novo plano.
              </p>
            </div>
            <div>
              <strong>Seu trabalho fica preservado</strong>
              <p>
                As tratativas registradas serão mantidas. Se a análise falhar, o
                plano atual será preservado.
              </p>
            </div>
          </div>
        )}
        <div className="confirmation-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {day?.plan ? "Manter plano atual" : "Cancelar"}
          </Button>
          <Button
            disabled={
              busy ||
              day?.status === "preparing" ||
              !day?.availableCapacity ||
              !orderCount
            }
            onClick={onPrepare}
          >
            {day?.plan ? "Gerar novo plano" : "Preparar plano com IA"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
