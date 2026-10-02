import { notFound } from "next/navigation";

// Pagina di prova: esiste solo in sviluppo (sul PC). Nella versione online
// risponde "pagina non trovata".
export default function LayoutSoloSviluppo({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
