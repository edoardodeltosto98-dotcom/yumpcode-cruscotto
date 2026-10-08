"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { useBackend } from "@/lib/backend";

type Stato = "in_attesa" | "approvata" | "rifiutata" | "eseguita" | "fallita";

type Scadenza = { titolo: string; data: string; giorniPreavviso: number; note?: string };

type Azione = {
  id: string;
  stato: Stato;
  dettagli: { scadenza?: Scadenza; risultato?: { link?: string | null } } | null;
  motivo: string | null;
  errore: string | null;
  created_at: string;
};

const ETICHETTA: Record<Stato, string> = {
  in_attesa: "Da approvare",
  approvata: "In esecuzione",
  rifiutata: "Rifiutata",
  eseguita: "In calendario",
  fallita: "Non riuscita",
};

const COLORE: Record<Stato, string> = {
  in_attesa: "bg-amber-100 text-amber-800",
  approvata: "bg-blue-100 text-blue-800",
  rifiutata: "bg-zinc-200 text-zinc-700",
  eseguita: "bg-green-100 text-green-800",
  fallita: "bg-red-100 text-red-800",
};

const PREAVVISO_DEFAULT = 7;
const PREAVVISO_MASSIMO = 28; // limite di Google Calendar per gli avvisi

// "AAAA-MM-GG" di oggi in Italia (il backend ragiona in Europe/Rome).
const oggi = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

// "2026-11-30" -> "30/11/2026" senza passare da Date (niente sorprese di fuso).
const dataIt = (data: string) => data.split("-").reverse().join("/");

const vuoto = { titolo: "", data: "", giorniPreavviso: String(PREAVVISO_DEFAULT), note: "" };

// Schermata "Scadenze": il cliente inserisce una scadenza, l'assistente
// propone un promemoria; dopo l'approvazione nasce un evento di tutto il
// giorno nel Google Calendar collegato, con avviso N giorni prima.
export default function PaginaScadenze() {
  const backend = useBackend();
  const { organization, membership } = useOrganization();
  const orgId = organization?.id;
  const admin = membership?.role === "org:admin";

  const [modulo, setModulo] = useState(vuoto);
  const [invio, setInvio] = useState(false);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [elenco, setElenco] = useState<Azione[] | null>(null);
  const [versione, setVersione] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    let annullato = false;
    backend<{ azioni: Azione[] }>("/azioni?tipo=promemoria-scadenza&limite=100")
      .then(({ azioni }) => {
        if (!annullato) setElenco(azioni);
      })
      .catch((e: Error) => {
        if (!annullato) setErrore(e.message);
      });
    return () => {
      annullato = true;
    };
  }, [backend, orgId, versione]);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setErrore(null);
    setAvviso(null);
    try {
      const { risultato } = await backend<{ risultato: { creata: boolean; motivo?: string } }>("/scadenze", {
        method: "POST",
        body: JSON.stringify({
          titolo: modulo.titolo,
          data: modulo.data,
          giorniPreavviso: Number(modulo.giorniPreavviso),
          note: modulo.note || undefined,
        }),
      });
      if (risultato.creata) {
        setModulo(vuoto);
        setAvviso("Scadenza salvata: l'assistente ha proposto il promemoria, lo trovi in Approvazioni.");
      } else {
        setErrore(`Promemoria non proposto: ${risultato.motivo ?? "motivo sconosciuto"}`);
      }
      setVersione((v) => v + 1);
    } catch (err) {
      setErrore((err as Error).message);
    } finally {
      setInvio(false);
    }
  }

  if (!organization) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p>Seleziona un&apos;organizzazione in alto a destra.</p>
      </div>
    );
  }

  const campo = "rounded border border-black/20 px-3 py-1.5";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Scadenze</h1>
        <p className="text-sm text-zinc-600">
          Inserisci una scadenza: l&apos;assistente propone un promemoria e, dopo l&apos;approvazione, lo mette nel Google
          Calendar collegato con un avviso in anticipo.
        </p>
      </div>

      {admin ? (
        <form onSubmit={salva} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 text-sm">
          <label className="flex flex-col gap-1">
            Cosa scade
            <input
              required
              maxLength={200}
              value={modulo.titolo}
              onChange={(e) => setModulo({ ...modulo, titolo: e.target.value })}
              placeholder="es. Fattura 124 — Rossi Srl"
              className={campo}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 flex-col gap-1">
              Data di scadenza
              <input
                required
                type="date"
                min={oggi()}
                value={modulo.data}
                onChange={(e) => setModulo({ ...modulo, data: e.target.value })}
                className={campo}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              Avviso quanti giorni prima
              <input
                required
                type="number"
                min={0}
                max={PREAVVISO_MASSIMO}
                step={1}
                value={modulo.giorniPreavviso}
                onChange={(e) => setModulo({ ...modulo, giorniPreavviso: e.target.value })}
                className={campo}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            Note (facoltative)
            <textarea
              maxLength={2000}
              rows={2}
              value={modulo.note}
              onChange={(e) => setModulo({ ...modulo, note: e.target.value })}
              placeholder="es. pagare con bonifico, riferimento contratto..."
              className={campo}
            />
          </label>
          <p className="text-xs text-zinc-500">
            L&apos;avviso arriva alle 9:00 del giorno indicato (con 0 giorni, a mezzanotte del giorno stesso). Massimo{" "}
            {PREAVVISO_MASSIMO} giorni prima.
          </p>
          <button type="submit" disabled={invio} className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            {invio ? "Salvo..." : "Salva scadenza"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">Puoi consultare l&apos;elenco; solo gli amministratori possono inserire scadenze.</p>
      )}

      {errore && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errore}</p>}
      {avviso && (
        <p role="status" className="rounded border border-black/10 bg-zinc-50 p-3 text-sm">
          {avviso}{" "}
          <Link href="/approvazioni" className="underline">
            Vai ad Approvazioni
          </Link>
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Scadenze inserite</h2>
        {elenco === null && !errore && <p className="text-sm text-zinc-500">Caricamento...</p>}
        {elenco?.length === 0 && (
          <p className="rounded border border-dashed border-black/20 p-6 text-center text-sm text-zinc-500">
            Nessuna scadenza inserita.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {elenco?.map((a) => {
            const s = a.dettagli?.scadenza;
            const link = a.dettagli?.risultato?.link;
            return (
              <li key={a.id} className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">{s?.titolo ?? "(senza titolo)"}</span>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${COLORE[a.stato]}`}>{ETICHETTA[a.stato]}</span>
                </div>
                {s && (
                  <span className="text-zinc-600">
                    Scade il {dataIt(s.data)} · avviso {s.giorniPreavviso === 0 ? "il giorno stesso" : `${s.giorniPreavviso} giorni prima`}
                  </span>
                )}
                {s?.note && <span className="whitespace-pre-wrap text-zinc-600">{s.note}</span>}
                {a.motivo && <span className="text-zinc-600">Motivo del rifiuto: {a.motivo}</span>}
                {a.errore && <span className="text-red-700">Errore: {a.errore}</span>}
                {link && (
                  <a href={link} target="_blank" rel="noreferrer" className="w-fit text-teal-700 underline">
                    Apri in Google Calendar
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
