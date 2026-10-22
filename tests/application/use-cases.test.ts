import { describe, expect, it, vi } from "vitest";
import { changeOrderCommand } from "@/application/orders/change-order";
import { updateTaskCommand } from "@/application/tasks/update-task";
import { repositoryDouble } from "../fixtures/operations-repository";
import { selectData, selectTasks } from "../browser/fixtures";

function setup() {
  const repository = repositoryDouble();
  const release = vi.fn(async () => {});
  repository.acquireAgentLease.mockResolvedValue(release);
  repository.getDataset.mockResolvedValue(selectData);
  repository.getSession.mockResolvedValue({
    tasks: selectTasks,
    investigations: [],
    expiresAt: "2026-10-30T12:00:00Z",
  });
  repository.saveCase.mockResolvedValue(undefined);
  return { repository, release };
}
describe("application commands through repository ports", () => {
  it("reviews status and persists the domain transition without a concrete adapter", async () => {
    const { repository, release } = setup();
    const record = await changeOrderCommand(repository, "session", {
      action: "review_status",
      orderId: "UI-CONFLICT",
      status: "em_analise",
      note: "Status validado na referência sintética da operação.",
    });
    expect(record.statusReview?.status).toBe("em_analise");
    expect(record.resolution).toBeUndefined();
    expect(repository.saveCase).toHaveBeenCalledExactlyOnceWith(
      "session",
      record,
    );
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("releases the lease after a domain validation error and does not persist", async () => {
    const { repository, release } = setup();
    await expect(
      changeOrderCommand(repository, "session", {
        action: "review_status",
        orderId: "UI-CONFLICT",
        status: "aguardando_cliente",
        note: "Referência sintética para um status que não está na origem.",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repository.saveCase).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed commands before acquiring a lease", async () => {
    const { repository } = setup();
    await expect(
      updateTaskCommand(repository, "session", { status: "aprovada" }),
    ).rejects.toThrow();
    expect(repository.acquireAgentLease).not.toHaveBeenCalled();
  });
  it("rejects a proposal through the task use case without executing or closing the case", async () => {
    const { repository, release } = setup();
    const task = selectTasks.find((item) => item.orderId === "UI-REFUND")!;
    const rejection = {
      note: "Conferir a documentação antes de autorizar o reembolso.",
    };
    repository.updateTask.mockResolvedValue({
      ...task,
      status: "rejeitada",
      rejection: { ...rejection, at: "2026-10-21T12:00:00Z" },
    });
    await updateTaskCommand(repository, "session", {
      id: task.id,
      status: "rejeitada",
      rejection,
    });
    expect(repository.updateTask).toHaveBeenCalledExactlyOnceWith(
      "session",
      task.id,
      "rejeitada",
      undefined,
      undefined,
      rejection,
      undefined,
    );
    expect(repository.completeTaskAndResolve).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
