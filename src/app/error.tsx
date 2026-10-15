"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal-error">
      <h1>Não foi possível abrir a central.</h1>
      <p>Tente novamente. Sua demonstração continua salva.</p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
