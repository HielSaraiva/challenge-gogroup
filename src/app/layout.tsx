import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";

import "./operations.css";
import "./brand.css";
export const metadata: Metadata = {
  title: "Gogroup | Central de Operações",
  description:
    "Priorize exceções, investigue evidências e transforme decisões em ações com IA.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
