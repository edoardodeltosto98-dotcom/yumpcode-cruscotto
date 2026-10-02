"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useBackend } from "@/lib/backend";

type Conteggi = {
  proposte: number;
  inAttesa: number;
  approvate: number;
  rifiutate: number;
  eseguite: number;
  fallite: number;
};

type NumeriMese = { mese: string; totale: Conteggi; perProcesso: ({ processo: string } & Conteggi)[] };
type Risposta = { meseCorrente: string; mese: NumeriMese; precedente: NumeriMese };

const VOCI: { chiave: keyof Conteggi; nome: string; spiegazione: string }[] = [
  { chiave: "proposte", nome: "Proposte", spiegazione: "Azioni proposte dall'assistente nel mese" },
  { chiave: "approvate", nome: "Approvate", spiegazione: "Approvate da un amministratore" },
  { chiave: "rifiutate", nome: "Rifiutate", spiegazione: "Rifiutate da un amministratore" },
  { chiave: "eseguite", nome: "Eseguite", spiegazione: "Portate a termine" },
  { chiave: "fallite", nome: "Fallite", spiegazione: "Approvate ma non riuscite" },
  { chiave: "inAttesa", nome: "In attesa", spiegazione: "Ancora da decidere" },
];

// "2026-10" -> "ottobre 2026"
const nomeMese = (mese: string, conAnno = true) => {
  const [anno, m] = mese.split("-").map(Number);
  return new Date(anno, m - 1, 1).toLocaleDateString("it-IT", conAnno ? { month: "long", year: "numeric" } : { month: "long" });
};

const sposta = (mese: string, diMesi: number) => {
  const [anno, m] = mese.split("-").map(Number);
  const d = new Date(anno, m - 1 + diMesi, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Schermata "Numeri del mese" (Fase 9): quante azioni l'assistente ha proposto
// nel mese e che fine hanno fatto, in totale e per processo, con il confronto
// sul mese precedente. Solo lettura, visibile a tutti i membri.
export default function PaginaNumeri() {
  const backend = useBackend();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [mese, setMese] = useState<string | null>(null); // null = mese corrente
  const [dati, setDati] = useState<Risposta | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let annullato = false;
    backend<Risposta>(`/numeri${mese ? `?mese=${mese}` : ""}`)
      .then((r) => {
        if (annullato) return;
        setDati(r);
        setErrore(null);
      })
      .catch((e: Error) => {
        if (!annullato) setErrore(e.message);
      });
    return () => {
      annullato = true;
    };
  }, [backend, orgId, mese]);

  if (!organization) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p>Seleziona un&apos;organizzazione in alto a destra.</p>
      </div>
    );
  }

  const mostrato = dati?.mese.mese;
  const ultimo = mostrato !== undefined && mostrato >= dati!.meseCorrente;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Numeri del mese</h1>
        <p className="text-sm text-zinc-600">
          Le azioni proposte dall&apos;assistente per <strong>{organization.name}</strong> e che fine hanno fatto.
        </p>
      </div>

      {errore && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errore}</p>}
      {!dati && !errore && <p className="text-sm text-zinc-500">Caricamento...</p>}

      {dati && mostrato && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setMese(sposta(mostrato, -1))} aria-label="Mese precedente" className="rounded border border-black/20 px-3 py-1 text-sm hover:bg-black/5">
              ←
            </button>
            <span className="min-w-40 text-center font-medium capitalize">{nomeMese(mostrato)}</span>
            <button
              onClick={() => setMese(sposta(mostrato, 1))}
              disabled={ultimo}
              aria-label="Mese successivo"
              className="rounded border border-black/20 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-40"
            >
              →
            </button>
            {!ultimo && (
              <button onClick={() => setMese(null)} className="text-sm text-zinc-600 underline">
                Torna al mese corrente
              </button>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {VOCI.map((v) => {
              const valore = dati.mese.totale[v.chiave];
              const differenza = valore - dati.precedente.totale[v.chiave];
              return (
                <div key={v.chiave} title={v.spiegazione} className="flex flex-col gap-1 rounded-lg border border-black/10 p-4">
                  <dt className="text-sm text-zinc-600">{v.nome}</dt>
                  <dd className="text-3xl font-semibold tabular-nums">{valore}</dd>
                  <dd className="text-xs text-zinc-500">
                    {differenza === 0 ? "come" : `${differenza > 0 ? "+" : "−"}${Math.abs(differenza)} rispetto a`}{" "}
                    {nomeMese(dati.precedente.mese, false)}
                  </dd>
                </div>
              );
            })}
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">Per processo</h2>
            {dati.mese.perProcesso.length === 0 ? (
              <p className="rounded border border-dashed border-black/20 p-6 text-center text-sm text-zinc-500">
                Nessuna azione proposta in {nomeMese(mostrato)}.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-black/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-left text-zinc-600">
                      <th scope="col" className="px-4 py-2 font-medium">Processo</th>
                      {VOCI.map((v) => (
                        <th key={v.chiave} scope="col" title={v.spiegazione} className="px-4 py-2 text-right font-medium">
                          {v.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dati.mese.perProcesso.map((p) => (
                      <tr key={p.processo} className="border-b border-black/5 last:border-0">
                        <th scope="row" className="px-4 py-2 text-left font-medium">{p.processo}</th>
                        {VOCI.map((v) => (
                          <td key={v.chiave} className="px-4 py-2 text-right tabular-nums">{p[v.chiave]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="text-xs text-zinc-500">
            I numeri riguardano le azioni proposte nel mese, contate secondo lo stato attuale. &quot;Approvate&quot; comprende
            quelle in esecuzione, eseguite e fallite.
          </p>
        </>
      )}
    </div>
  );
}
