"use client";

import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useBackend } from "@/lib/backend";

type Risultato = { stato: "attesa" } | { stato: "ok"; dati: unknown } | { stato: "errore"; messaggio: string };

type Azione = {
  id: string;
  processo: string;
  tipo: string;
  record_riferimento: string;
  stato: "in_attesa" | "approvata" | "rifiutata" | "eseguita" | "fallita";
  motivo: string | null;
  errore: string | null;
  created_at: string;
};

const COLORE_STATO: Record<Azione["stato"], string> = {
  in_attesa: "bg-amber-100 text-amber-800",
  approvata: "bg-blue-100 text-blue-800",
  rifiutata: "bg-zinc-200 text-zinc-700",
  eseguita: "bg-green-100 text-green-800",
  fallita: "bg-red-100 text-red-800",
};

// Pagina di prova del login Clerk sul backend e delle approvazioni (Fase 8):
// chiama assistente-core con il token di sessione e mostra cosa risponde per
// l'organizzazione attiva.
export default function PaginaTestBackend() {
  const backend = useBackend();
  const { organization, membership } = useOrganization();
  const orgId = organization?.id;
  const [regole, setRegole] = useState<Risultato>({ stato: "attesa" });
  const [azioni, setAzioni] = useState<Azione[] | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [google, setGoogle] = useState<string | null>(null);

  const ricaricaAzioni = useCallback(async () => {
    try {
      const { azioni } = await backend<{ azioni: Azione[] }>("/azioni?limite=20");
      setAzioni(azioni);
    } catch (e) {
      setMessaggio(`Errore: ${(e as Error).message}`);
    }
  }, [backend]);

  useEffect(() => {
    if (!orgId) return;
    backend("/regole")
      .then((dati) => setRegole({ stato: "ok", dati }))
      .catch((e: Error) => setRegole({ stato: "errore", messaggio: e.message }));
    backend<{ azioni: Azione[] }>("/azioni?limite=20")
      .then(({ azioni }) => setAzioni(azioni))
      .catch((e: Error) => setMessaggio(`Errore: ${e.message}`));
  }, [backend, orgId]);

  // tipo "test": va sempre a buon fine. "test-fallisce": fallisce al primo
  // tentativo e riesce con Riprova. "evento-calendario": crea davvero un
  // evento di prova domani alle 10:00 nel Google Calendar collegato.
  async function creaAzioneDiProva(tipo: "test" | "test-fallisce" | "evento-calendario" = "test") {
    setMessaggio("Creo l'azione di prova...");
    try {
      // Regola "prova" sempre attiva (fascia tutto il giorno), poi un trigger di tipo "test".
      await backend("/regole?processo=prova", {
        method: "POST",
        body: JSON.stringify({ fasciaOrariaInizio: "00:00", fasciaOrariaFine: "23:59", maxAzioniGiorno: 100 }),
      });
      const { risultato } = await backend<{ risultato: { creata: boolean; motivo?: string } }>("/trigger/valuta", {
        method: "POST",
        body: JSON.stringify({
          processo: "prova",
          recordRiferimento: `prova-${Date.now()}`,
          tipo,
          dettagli: tipo === "evento-calendario" ? { evento: eventoDiProva() } : undefined,
        }),
      });
      setMessaggio(risultato.creata ? "Azione di prova creata: e' in attesa di approvazione." : `Non creata: ${risultato.motivo}`);
      await ricaricaAzioni();
    } catch (e) {
      setMessaggio(`Errore: ${(e as Error).message}`);
    }
  }

  async function decidi(id: string, azione: "approva" | "rifiuta" | "riprova") {
    setMessaggio(null);
    try {
      const body = azione === "rifiuta" ? JSON.stringify({ motivo: "Rifiutata dalla pagina di test" }) : undefined;
      await backend(`/azioni/${id}/${azione}`, { method: "POST", body });
      await ricaricaAzioni();
      // L'esecuzione avviene in coda: ricarichiamo dopo qualche secondo per vedere "eseguita".
      if (azione !== "rifiuta") setTimeout(ricaricaAzioni, 3000);
    } catch (e) {
      setMessaggio(`Errore: ${(e as Error).message}`);
    }
  }

  async function collegaGoogle() {
    setGoogle("Genero il link...");
    try {
      const { url } = await backend<{ url: string }>("/auth/google/link", { method: "POST" });
      // Navigazione vera, non fetch: Google deve mostrare la schermata di consenso.
      window.location.href = url;
    } catch (e) {
      setGoogle(`Errore: ${(e as Error).message}`);
    }
  }

  async function verificaGoogle() {
    setGoogle("Verifico...");
    try {
      const { messaggio } = await backend<{ messaggio: string }>("/auth/google/verifica-token");
      setGoogle(messaggio);
    } catch (e) {
      setGoogle(`Errore: ${(e as Error).message}`);
    }
  }

  if (!organization) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p>Seleziona un&apos;organizzazione in alto a destra.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Test backend</h1>
        <p className="text-sm text-zinc-600">
          Organizzazione: <strong>{organization.name}</strong> · ruolo: <strong>{membership?.role ?? "?"}</strong>
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Azioni (Fase 8: approvazioni)</h2>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={ricaricaAzioni} className="rounded border border-black/20 px-3 py-1.5 text-sm">
              Aggiorna
            </button>
            <button onClick={() => creaAzioneDiProva("test")} className="rounded bg-black px-3 py-1.5 text-sm text-white">
              Crea azione di prova
            </button>
            <button onClick={() => creaAzioneDiProva("test-fallisce")} className="rounded border border-black/20 px-3 py-1.5 text-sm">
              Crea azione che fallisce
            </button>
            <button onClick={() => creaAzioneDiProva("evento-calendario")} className="rounded border border-black/20 px-3 py-1.5 text-sm">
              Crea evento calendario
            </button>
          </div>
        </div>
        {messaggio && <p className="text-sm">{messaggio}</p>}
        {azioni === null && <p className="text-sm text-zinc-500">Caricamento...</p>}
        {azioni?.length === 0 && <p className="text-sm text-zinc-500">Nessuna azione.</p>}
        <ul className="flex flex-col gap-2">
          {azioni?.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded border border-black/10 p-3 text-sm">
              <div className="flex flex-col">
                <span>
                  <strong>{a.processo}</strong> · {a.tipo} · {a.record_riferimento}
                </span>
                <span className="text-xs text-zinc-500">{new Date(a.created_at).toLocaleString("it-IT")}</span>
                {a.motivo && <span className="text-xs text-zinc-600">Motivo: {a.motivo}</span>}
                {a.errore && <span className="text-xs text-red-700">Errore: {a.errore}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs ${COLORE_STATO[a.stato]}`}>{a.stato}</span>
                {a.stato === "in_attesa" && (
                  <>
                    <button onClick={() => decidi(a.id, "approva")} className="rounded bg-green-700 px-2 py-1 text-xs text-white">
                      Approva
                    </button>
                    <button onClick={() => decidi(a.id, "rifiuta")} className="rounded border border-black/20 px-2 py-1 text-xs">
                      Rifiuta
                    </button>
                  </>
                )}
                {a.stato === "fallita" && (
                  <button onClick={() => decidi(a.id, "riprova")} className="rounded border border-black/20 px-2 py-1 text-xs">
                    Riprova
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Blocco titolo="GET /regole" risultato={regole} />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Google</h2>
        <div className="flex gap-2">
          <button onClick={collegaGoogle} className="rounded bg-black px-3 py-2 text-sm text-white">
            Collega account Google
          </button>
          <button onClick={verificaGoogle} className="rounded border border-black/20 px-3 py-2 text-sm">
            Verifica collegamento
          </button>
        </div>
        {google && <p className="text-sm">{google}</p>}
      </section>
    </main>
  );
}

// Evento di prova: domani dalle 10:00 alle 10:30, ora italiana. Gli orari
// partono SENZA fuso: lo fissa il backend (Europe/Rome), quindi il fuso di
// questo PC o del browser non conta.
function eventoDiProva() {
  // "Domani" secondo il calendario italiano: en-CA scrive la data come AAAA-MM-GG.
  const domani = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(Date.now() + 24 * 60 * 60 * 1000);
  return {
    titolo: "Prova assistente YUMPCODE",
    descrizione: "Evento di prova creato da un'azione approvata. Si puo' cancellare.",
    inizio: `${domani}T10:00`,
    fine: `${domani}T10:30`,
  };
}

function Blocco({ titolo, risultato }: { titolo: string; risultato: Risultato }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-medium">{titolo}</h2>
      {risultato.stato === "attesa" && <p className="text-sm text-zinc-500">Caricamento...</p>}
      {risultato.stato === "errore" && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{risultato.messaggio}</p>
      )}
      {risultato.stato === "ok" && (
        <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs">{JSON.stringify(risultato.dati, null, 2)}</pre>
      )}
    </section>
  );
}
