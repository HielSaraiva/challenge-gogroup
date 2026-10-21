import { z } from "zod";
import { DEFAULT_WEIGHTS } from "@/domain/types";
import { AppError } from "./errors";
const weight = z.coerce.number().finite().min(0).max(100);
export function parseWeights(params: URLSearchParams) {
  const weights = {
    value: weight.parse(params.get("value") ?? DEFAULT_WEIGHTS.value),
    urgency: weight.parse(params.get("urgency") ?? DEFAULT_WEIGHTS.urgency),
    relationship: weight.parse(
      params.get("relationship") ?? DEFAULT_WEIGHTS.relationship,
    ),
  };
  if (!Object.values(weights).some((v) => v > 0))
    throw new AppError("Ao menos um peso deve ser positivo.");
  return weights;
}
