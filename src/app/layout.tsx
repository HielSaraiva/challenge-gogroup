import type { Metadata } from "next";
import "@/presentation/styles/base.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";

import "@/presentation/styles/components.css";
import "@/presentation/styles/brand.css";
import "@/presentation/styles/dialogs.css";
import "@/presentation/styles/workspace.css";
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
