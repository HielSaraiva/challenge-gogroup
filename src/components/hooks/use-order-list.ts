"use client";
import { useState } from "react";
import { exceptionLabels, type RankedOrder } from "@/domain/types";
import { statusLabel } from "@/lib/utils";
import { orderList } from "@/lib/order-list";

export function useOrderList(
  orders: RankedOrder[],
  planOrders: RankedOrder[] | undefined,
  ready: boolean,
) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [exceptionFilter, setExceptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const sourceOrders = all || !ready ? orders : planOrders || [];
  const visible = orderList(
    sourceOrders,
    { query, exception: exceptionFilter, status: statusFilter },
    !all && ready,
  );
  const hasOrderFilters = Boolean(
    query.trim() || exceptionFilter || statusFilter,
  );
  const exceptionOptions = [
    ...new Set(sourceOrders.map((order) => order.exception)),
  ].sort((a, b) =>
    (exceptionLabels[a] || a).localeCompare(exceptionLabels[b] || b, "pt-BR"),
  );
  const statusOptions = [
    ...new Set(sourceOrders.map((order) => order.status)),
  ].sort((a, b) => statusLabel(a).localeCompare(statusLabel(b), "pt-BR"));
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  function resetFilters() {
    setQuery("");
    setExceptionFilter("");
    setStatusFilter("");
    setPage(1);
    setPageSize(10);
    setAll(false);
  }
  return {
    all,
    setAll,
    query,
    setQuery,
    pageSize,
    setPageSize,
    exceptionFilter,
    setExceptionFilter,
    statusFilter,
    setStatusFilter,
    setPage,
    visible,
    sourceOrders,
    hasOrderFilters,
    exceptionOptions,
    statusOptions,
    currentPage,
    totalPages,
    resetFilters,
  };
}
export type OrderListController = ReturnType<typeof useOrderList>;
