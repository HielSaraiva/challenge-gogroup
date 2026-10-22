"use client";
import { DEFAULT_WEIGHTS } from "@/domain/types";
import { DataImport } from "@/presentation/features/data/data-import";
import { Methodology } from "@/presentation/features/methodology/methodology";
import { OrderDetails } from "@/presentation/features/orders/order-details";
import { OrdersWorkspace } from "@/presentation/features/orders/orders-workspace";
import { PendingWorkspace } from "@/presentation/features/pending/pending-workspace";
import { RecurrenceInvestigation } from "@/presentation/features/recurrences/recurrence-investigation";
import { RecurrencesWorkspace } from "@/presentation/features/recurrences/recurrences-workspace";
import { FinancialImpact } from "@/presentation/features/results/financial-impact";
import { PlanDialog } from "@/presentation/features/today/plan-dialog";
import { TodayWorkspace } from "@/presentation/features/today/today-workspace";
import { AgentProgress } from "@/presentation/shared/agent-progress";
import { FormSafetyBoundary } from "@/presentation/shared/hooks/form-safety";
import { Button } from "@/presentation/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/presentation/shared/ui/dialog";
import { AppHeader } from "@/presentation/shell/app-header";
import { pageDescriptions, pageTitles } from "@/presentation/shell/navigation";
import { generatedTextLabel } from "@/shared/formatting";
import { useOperationsViewModel } from "./use-operations-view-model";

export function OperationsApp() {
  const model = useOperationsViewModel();
  const {
    tab,
    menu,
    setMenu,
    heading,
    dailyActivity,
    scrollToDailyActivity,
    summary,
    day,
    financial,
    orders,
    patterns,
    tasks,
    runs,
    setSelectedId,
    setProcessId,
    setProcessDirty,
    setProcessSaving,
    processDestination,
    setProcessDestination,
    changeProcess,
    activePatternId,
    loading,
    busy,
    activeRun,
    error,
    setError,
    notice,
    setNotice,
    orderSafety,
    setOrderSafety,
    confirmOrderClose,
    setConfirmOrderClose,
    resetBusy,
    refreshWarning,
    resetting,
    setResetting,
    sessionRevision,
    confirmNewPlan,
    setConfirmNewPlan,
    planStrategy,
    setPlanStrategy,
    ready,
    orderFilters,
    setAll,
    navigate,
    refreshAfterSave,
    investigate,
    reset,
    selected,
    processTask,
    processPattern,
    openOrder,
    pendingCount,
    handleImported,
  } = model;
  function activity(...args: Parameters<typeof model.activity>) {
    const data = model.activity(...args);
    return data ? <AgentProgress {...data} /> : null;
  }
  return (
    <div className="app-layout">
      <AppHeader
        tab={tab}
        menu={menu}
        setMenu={setMenu}
        pendingCount={pendingCount}
        navigate={navigate}
      />
      <div className="main-shell">
        <main>
          <div
            className={`page-heading ${tab === "overview" ? "brand-opening" : ""}`}
          >
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {pageTitles[tab]}
              </h1>
              <p>{pageDescriptions[tab]}</p>
            </div>
            <div className="date-chip">
              <span>
                Referência do piloto
                <br />
                <b>30/09/2026</b>
              </span>
            </div>
          </div>
          {error && (
            <div className="alert alert-error" role="alert">
              {generatedTextLabel(error)}
              <button aria-label="Dispensar erro" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert alert-info" role="status">
              {notice}
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {tab === "data" ? (
            <>
              <DataImport key={sessionRevision} onImported={handleImported} />
              <section className="panel prose reset-panel">
                <h2>Reiniciar a demonstração</h2>
                <p>
                  Volte à base padrão de 30/09/2026. A importação desta sessão,
                  os planos, as tarefas, as investigações e os resultados não
                  serão mantidos na nova demonstração.
                </p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setResetting(true)}
                >
                  Reiniciar minha demonstração
                </Button>
              </section>
            </>
          ) : tab === "method" ? (
            <Methodology
              summary={summary}
              weights={day?.plan?.weights || DEFAULT_WEIGHTS}
            />
          ) : loading ? (
            <p role="status">Conferindo a operação…</p>
          ) : !summary ? (
            <section className="panel prose">
              <h2>Comece pela base de operações</h2>
              <p>
                Importe os três CSVs e confira a qualidade antes de preparar o
                trabalho com IA.
              </p>
              <Button onClick={() => navigate("data")}>
                Abrir Dados e importar
              </Button>
            </section>
          ) : (
            <>
              {tab === "overview" && (
                <TodayWorkspace
                  summary={summary}
                  day={day}
                  orders={orders}
                  ready={ready}
                  busy={busy}
                  activity={activity("daily")}
                  dailyActivity={dailyActivity}
                  openOrder={openOrder}
                  onPrepare={() => {
                    setPlanStrategy(day?.plan?.strategy || "equilibrada");
                    setConfirmNewPlan(true);
                  }}
                  onBrowse={() => {
                    setAll(!ready);
                    navigate("queue");
                  }}
                  onBrowseAll={() => {
                    setAll(true);
                    navigate("queue");
                  }}
                />
              )}
              {tab === "queue" && (
                <OrdersWorkspace
                  day={day}
                  ready={ready}
                  list={orderFilters}
                  onOrder={openOrder}
                  onPrepare={() => navigate("overview")}
                />
              )}
              {tab === "agent" && (
                <PendingWorkspace
                  key={sessionRevision}
                  orders={orders}
                  tasks={tasks}
                  onOrder={openOrder}
                  onProcess={setProcessId}
                />
              )}
              {tab === "impact" && financial && (
                <FinancialImpact
                  report={financial}
                  capacity={day?.plan ? day : undefined}
                />
              )}
              {tab === "insights" && (
                <RecurrencesWorkspace
                  key={sessionRevision}
                  patterns={patterns}
                  tasks={tasks}
                  runs={runs}
                  busy={busy}
                  analyzing={
                    busy &&
                    (activeRun?.type === "recurrences" ||
                      activeRun?.type === "pattern")
                  }
                  onAnalyze={() => investigate("base", "recurrences")}
                  activity={
                    activeRun?.type === "pattern" && activePatternId
                      ? activity("pattern", activePatternId)
                      : activity("recurrences")
                  }
                  onInvestigate={(id, previousId) =>
                    investigate(id, "pattern", previousId)
                  }
                  onProcess={setProcessId}
                  onPending={() => navigate("agent")}
                />
              )}
            </>
          )}
          {refreshWarning && (
            <div className="alert alert-info" role="status">
              {refreshWarning}{" "}
              <Button
                variant="outline"
                onClick={() =>
                  void refreshAfterSave(refreshWarning || undefined)
                }
              >
                Atualizar tela
              </Button>
            </div>
          )}
          <footer className="app-footer">
            <p className="footer-disclaimer">
              <span>Dados sintéticos · sessão independente</span>
              <span>Sem ações externas automáticas.</span>
            </p>
          </footer>
        </main>
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !orderSafety.busy) {
            if (orderSafety.dirty) setConfirmOrderClose(true);
            else setSelectedId(undefined);
          }
        }}
      >
        <DialogContent className="order-dialog">
          <FormSafetyBoundary onChange={setOrderSafety}>
            {refreshWarning && (
              <div className="alert alert-info" role="status">
                {refreshWarning}{" "}
                <Button
                  variant="outline"
                  onClick={() =>
                    void refreshAfterSave(refreshWarning || undefined)
                  }
                >
                  Atualizar tela
                </Button>
              </div>
            )}
            {selected && (
              <OrderDetails
                selected={selected}
                orders={orders}
                tasks={tasks}
                runs={runs}
                activeRun={activeRun}
                busy={busy}
                activity={activity("order", selected.id)}
                onInvestigate={(id) => void investigate(id, "order")}
                refreshAfterSave={refreshAfterSave}
              />
            )}
          </FormSafetyBoundary>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(processTask)}
        onOpenChange={(open) => {
          if (!open) changeProcess();
        }}
      >
        <DialogContent className="recurrence-dialog">
          {refreshWarning && (
            <div className="alert alert-info" role="status">
              {refreshWarning}{" "}
              <Button
                variant="outline"
                onClick={() =>
                  void refreshAfterSave(refreshWarning || undefined)
                }
              >
                Atualizar tela
              </Button>
            </div>
          )}
          {processTask && (
            <>
              <DialogTitle>{generatedTextLabel(processTask.title)}</DialogTitle>
              <DialogDescription>
                Confira as evidências, salve o andamento e registre a conclusão
                quando terminar a verificação.
              </DialogDescription>
              {processTask.previousTaskId && (
                <Button
                  variant="outline"
                  onClick={() => changeProcess(processTask.previousTaskId)}
                >
                  Consultar investigação anterior
                </Button>
              )}
              <RecurrenceInvestigation
                key={processTask.id}
                task={processTask}
                orders={orders}
                pattern={processPattern}
                onDirtyChange={setProcessDirty}
                onBusyChange={setProcessSaving}
                onSaved={refreshAfterSave}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={processDestination !== undefined}
        onOpenChange={(open) => {
          if (!open) setProcessDestination(undefined);
        }}
      >
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Para retomar estas anotações depois, volte e use “Salvar progresso”.
            Sair agora descarta apenas as alterações desde o último salvamento.
          </DialogDescription>
          <div className="confirmation-footer">
            <Button
              variant="outline"
              onClick={() => setProcessDestination(undefined)}
            >
              Continuar editando
            </Button>
            <Button
              onClick={() => {
                setProcessDirty(false);
                setProcessId(processDestination || undefined);
                setProcessDestination(undefined);
              }}
            >
              Sair sem salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PlanDialog
        open={confirmNewPlan}
        onOpenChange={setConfirmNewPlan}
        day={day}
        orderCount={summary?.count}
        strategy={planStrategy}
        onStrategyChange={setPlanStrategy}
        busy={busy}
        onCloseAutoFocus={(event) => {
          if (scrollToDailyActivity.current || busy) event.preventDefault();
        }}
        onPrepare={() => {
          setConfirmNewPlan(false);
          scrollToDailyActivity.current = true;
          void investigate("day", "daily");
        }}
      />
      <Dialog open={confirmOrderClose} onOpenChange={setConfirmOrderClose}>
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>
            Sair descarta os campos ainda não registrados neste pedido.
          </DialogDescription>
          <div className="confirmation-footer">
            <Button
              variant="outline"
              onClick={() => setConfirmOrderClose(false)}
            >
              Continuar editando
            </Button>
            <Button
              onClick={() => {
                setConfirmOrderClose(false);
                setSelectedId(undefined);
              }}
            >
              Sair sem salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={resetting}
        onOpenChange={(open) => {
          if (!resetBusy) setResetting(open);
        }}
      >
        <DialogContent className="confirmation-dialog">
          <DialogTitle>Reiniciar esta demonstração?</DialogTitle>
          <DialogDescription>
            A nova sessão não terá planos, tarefas, investigações ou resultados.
            A base padrão de 30/09/2026 será restaurada. A base importada nesta
            sessão e os registros anteriores não serão copiados para a nova
            avaliação.
          </DialogDescription>
          <div className="confirmation-footer">
            <Button
              variant="outline"
              disabled={resetBusy}
              onClick={() => setResetting(false)}
            >
              Cancelar
            </Button>
            <Button disabled={resetBusy} onClick={() => void reset()}>
              {resetBusy ? "Reiniciando…" : "Confirmar reinício"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
