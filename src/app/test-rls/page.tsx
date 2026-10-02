"use client";

import { useEffect, useState } from "react";
import { useSupabaseClient } from "@/lib/supabase/client";

type Cliente = {
  id: string;
  nome: string;
  email: string;
  org_id: string | null;
};

export default function PaginaTestRLS() {
  const supabase = useSupabaseClient();
  const [clienti, setClienti] = useState<Cliente[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("clienti")
      .select("id, nome, email, org_id")
      .then(({ data, error }) => {
        if (error) setErrore(error.message);
        else setClienti(data);
      });
  }, [supabase]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Test RLS multi-tenant</h1>
      <p className="text-sm text-zinc-600">
        Legge la tabella <code>clienti</code> usando il token Clerk della organizzazione attiva.
        Con RLS attiva deve comparire solo la riga con lo stesso <code>org_id</code>.
      </p>

      {errore && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Errore: {errore}
        </p>
      )}

      {!errore && clienti === null && <p className="text-sm text-zinc-500">Caricamento...</p>}

      {clienti && clienti.length === 0 && (
        <p className="text-sm text-zinc-500">Nessuna riga visibile per l&apos;organizzazione corrente.</p>
      )}

      {clienti && clienti.length > 0 && (
        <ul className="flex flex-col gap-2">
          {clienti.map((c) => (
            <li key={c.id} className="rounded border border-black/10 p-3 text-sm">
              <div className="font-medium">{c.nome}</div>
              <div className="text-zinc-500">{c.email}</div>
              <div className="text-xs text-zinc-400">org_id: {c.org_id}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
