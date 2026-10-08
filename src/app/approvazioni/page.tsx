"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useBackend } from "@/lib/backend";

type Stato = "in_attesa" | "approvata" | "rifiutata" | "eseguita" | "fallita";

type Azione = {
  id: string;
  processo: string;
  tipo: string;
  record_riferimento: string;
  stato: Stato;
  dettagli: {
    testo?: string | null;
    evento?: { titolo?: string; inizio?: string; fine?: string };
    scadenza?: { titolo?: string; data?: string; giorniPreavviso?: number; note?: string };
    risultato?: { link?: string | null };
  } | null;
  motivo: string | null;
  errore: string | null;
  created_at: string;
};

type Evento = {
  id: string;
  da_stato: Stato | null;
  a_stato: Stato;
  attore: string;
  nota: string | null;
  created_at: string;
};

const ETICHETTA: Record<Stato, string> = {
  in_attesa: "In attesa",
  approvata: "In esecuzione",
  rifiutata: "Rifiutata",
  eseguita: "Eseguita",
  fallita: "Fallita",
};

const COLORE: Record<Stato, string> = {
  in_attesa: "bg-amber-100 text-amber-800",
  approvata: "bg-blue-100 text-blue-800",
  rifiutata: "bg-zinc-200 text-zinc-700",
  eseguita: "bg-green-100 text-green-800",
  fallita: "bg-red-100 text-red-800",
};

const FILTRI: { valore: Stato | "tutte"; nome: string }[] = [
  { valore: "in_attesa", nome: "In attesa" },
  { valore: "fallita", nome: "Fallite" },
  { valore: "eseguita", nome: "Eseguite" },
  { valore: "rifiutata", nome: "Rifiutate" },
  { valore: "tutte", nome: "Tutte" },
];

const dataOra = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Schermata "Approvazioni" (Fase 8/9): le azioni proposte dall'assistente.
// Tutti i membri dell'organizzazione le vedono; solo gli admin decidono
// (il backend lo impone comunque: qui nascondiamo solo i pulsanti).
export default function PaginaApprovazioni() {
  const backend = useBackend();
  const { organization, membership } = useOrganization();
  const orgId = organization?.id;
  const admin = membership?.role === "org:admin";

  const [filtro, setFiltro] = useState<Stato | "tutte">("in_attesa");
  const [azioni, setAzioni] = useState<Azione[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const [versione, setVersione] = useState(0); // +1 = ricarica l'elenco
  const [occupata, setOccupata] = useState<string | null>(null); // id dell'azione su cui stiamo operando
  const [rifiuto, setRifiuto] = useState<{ id: string; motivo: string } | null>(null);
  const [storico, setStorico] = useState<{ id: string; eventi: Evento[] | null } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let annullato = false;
    const query = filtro === "tutte" ? "" : `&stato=${filtro}`;
    backend<{ azioni: Azione[] }>(`/azioni?limite=100${query}`)
      .then(({ azioni }) => {
        if (annullato) return;
        setAzioni(azioni);
        setErrore(null);
      })
      .catch((e: Error) => {
        if (!annullato) setErrore(e.message);
      });
    return () => {
      annullato = true;
    };
  }, [backend, orgId, filtro, versione]);

  // Finche' c'e' qualcosa in esecuzione (o l'abbiamo appena approvato)
  // ricarichiamo da soli ogni 3 secondi, per mostrare l'esito senza premere nulla.
  const inEsecuzione = azioni?.some((a) => a.stato === "approvata") ?? false;
  const [attesaEsito, setAttesaEsito] = useState(0);
  useEffect(() => {
    if (!inEsecuzione && attesaEsito === 0) return;
    const timer = setTimeout(() => {
      setAttesaEsito((n) => Math.max(0, n - 1));
      setVersione((v) => v + 1);
    }, 3000);
    return () => clearTimeout(timer);
  }, [inEsecuzione, attesaEsito, versione]);

  async function decidi(id: string, cosa: "approva" | "rifiuta" | "riprova", motivo?: string) {
    setOccupata(id);
    setErrore(null);
    setAvviso(null);
    try {
      await backend(`/azioni/${id}/${cosa}`, {
        method: "POST",
        body: cosa === "rifiuta" ? JSON.stringify({ motivo }) : undefined,
      });
      setRifiuto(null);
      if (cosa !== "rifiuta") setAttesaEsito(3);
      setAvviso(
        cosa === "rifiuta"
          ? "Azione rifiutata: la trovi in \"Rifiutate\"."
          : "Azione mandata in esecuzione: tra pochi secondi la trovi in \"Eseguite\" (o in \"Fallite\" se qualcosa va storto).",
      );
      if (storico?.id === id) setStorico(null);
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setOccupata(null);
      setVersione((v) => v + 1);
    }
  }

  async function mostraStorico(id: string) {
    if (storico?.id === id) return setStorico(null);
    setStorico({ id, eventi: null });
    try {
      const { eventi } = await backend<{ eventi: Evento[] }>(`/azioni/${id}`);
      setStorico({ id, eventi });
    } catch (e) {
      setStorico(null);
      setErrore((e as Error).message);
    }
  }

  if (!organization) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p>Seleziona un&apos;organizzazione in alto a destra.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Approvazioni</h1>
        <p className="text-sm text-zinc-600">
          Le azioni proposte dall&apos;assistente per <strong>{organization.name}</strong>. Nulla viene eseguito senza
          approvazione.
        </p>
        {!admin && <p className="mt-1 text-sm text-zinc-500">Puoi consultare l&apos;elenco; solo gli amministratori possono decidere.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTRI.map((f) => (
          <button
            key={f.valore}
            onClick={() => {
              setAzioni(null);
              setFiltro(f.valore);
            }}
            aria-pressed={filtro === f.valore}
            className={`rounded-full border px-3 py-1 text-sm ${
              filtro === f.valore ? "border-black bg-black text-white" : "border-black/20 hover:bg-black/5"
            }`}
          >
            {f.nome}
          </button>
        ))}
        <button onClick={() => setVersione((v) => v + 1)} className="ml-auto rounded border border-black/20 px-3 py-1 text-sm hover:bg-black/5">
          Aggiorna
        </button>
      </div>

      {errore && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errore}</p>}
      {avviso && <p role="status" className="rounded border border-black/10 bg-zinc-50 p-3 text-sm">{avviso}</p>}
      {azioni === null && !errore && <p className="text-sm text-zinc-500">Caricamento...</p>}
      {azioni?.length === 0 && (
        <p className="rounded border border-dashed border-black/20 p-6 text-center text-sm text-zinc-500">
          {filtro === "in_attesa" ? "Nessuna azione in attesa di approvazione." : "Nessuna azione in questo elenco."}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {azioni?.map((a) => {
          const evento = a.dettagli?.evento;
          const scadenza = a.dettagli?.scadenza;
          const link = a.dettagli?.risultato?.link;
          const ferma = occupata === a.id;
          return (
            <li key={a.id} className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">
                    {a.processo} · {a.tipo}
                  </span>
                  <span className="break-all text-xs text-zinc-500">
                    {a.record_riferimento} · {dataOra(a.created_at)}
                  </span>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${COLORE[a.stato]}`}>{ETICHETTA[a.stato]}</span>
              </div>

              {a.dettagli?.testo && <p className="whitespace-pre-wrap">{a.dettagli.testo}</p>}
              {evento?.titolo && (
                <p>
                  Evento in calendario: <strong>{evento.titolo}</strong>
                  {evento.inizio && evento.fine && ` — ${dataOra(evento.inizio)} / ${dataOra(evento.fine)}`}
                </p>
              )}
              {scadenza?.titolo && (
                <p>
                  Promemoria in calendario: <strong>{scadenza.titolo}</strong>
                  {scadenza.data && ` — scade il ${scadenza.data.split("-").reverse().join("/")}`}
                  {scadenza.giorniPreavviso !== undefined &&
                    ` · avviso ${scadenza.giorniPreavviso === 0 ? "il giorno stesso" : `${scadenza.giorniPreavviso} giorni prima`}`}
                  {scadenza.note && <span className="block whitespace-pre-wrap text-zinc-600">{scadenza.note}</span>}
                </p>
              )}
              {link && (
                <a href={link} target="_blank" rel="noreferrer" className="w-fit text-teal-700 underline">
                  Apri l&apos;evento creato
                </a>
              )}
              {a.motivo && <p className="text-zinc-600">Motivo del rifiuto: {a.motivo}</p>}
              {a.errore && <p className="text-red-700">Errore: {a.errore}</p>}

              <div className="flex flex-wrap items-center gap-2">
                {admin && a.stato === "in_attesa" && rifiuto?.id !== a.id && (
                  <>
                    <button disabled={ferma} onClick={() => decidi(a.id, "approva")} className="rounded bg-green-700 px-3 py-1.5 text-white disabled:opacity-50">
                      Approva
                    </button>
                    <button disabled={ferma} onClick={() => setRifiuto({ id: a.id, motivo: "" })} className="rounded border border-black/20 px-3 py-1.5 disabled:opacity-50">
                      Rifiuta
                    </button>
                  </>
                )}
                {admin && a.stato === "fallita" && (
                  <button disabled={ferma} onClick={() => decidi(a.id, "riprova")} className="rounded border border-black/20 px-3 py-1.5 disabled:opacity-50">
                    Riprova
                  </button>
                )}
                <button onClick={() => mostraStorico(a.id)} className="ml-auto text-xs text-zinc-600 underline">
                  {storico?.id === a.id ? "Nascondi storico" : "Storico"}
                </button>
              </div>

              {rifiuto?.id === a.id && (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void decidi(a.id, "rifiuta", rifiuto.motivo);
                  }}
                >
                  <input
                    autoFocus
                    value={rifiuto.motivo}
                    onChange={(e) => setRifiuto({ id: a.id, motivo: e.target.value })}
                    placeholder="Motivo (facoltativo)"
                    aria-label="Motivo del rifiuto"
                    maxLength={500}
                    className="min-w-0 flex-1 rounded border border-black/20 px-3 py-1.5"
                  />
                  <button type="submit" disabled={ferma} className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50">
                    Conferma rifiuto
                  </button>
                  <button type="button" onClick={() => setRifiuto(null)} className="rounded border border-black/20 px-3 py-1.5">
                    Annulla
                  </button>
                </form>
              )}

              {storico?.id === a.id && (
                <div className="rounded bg-zinc-50 p-3 text-xs">
                  {storico.eventi === null && <p className="text-zinc-500">Caricamento...</p>}
                  <ol className="flex flex-col gap-1">
                    {storico.eventi?.map((ev) => (
                      <li key={ev.id}>
                        <span className="text-zinc-500">{dataOra(ev.created_at)}</span> ·{" "}
                        {ev.da_stato ? `${ETICHETTA[ev.da_stato]} → ` : ""}
                        <strong>{ETICHETTA[ev.a_stato]}</strong> · {ev.attore === "sistema" ? "assistente" : "utente"}
                        {ev.nota && ` · ${ev.nota}`}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
