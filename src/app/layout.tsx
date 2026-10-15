import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Órbita | Central de Operações", description: "Priorize exceções, investigue evidências e transforme decisões em ações com IA.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
