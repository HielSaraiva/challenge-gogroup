/** Read-only transport; mutation success must not depend on a subsequent refresh. */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || "Não foi possível carregar a operação.");
  return body;
}
