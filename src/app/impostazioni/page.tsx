"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useBackend } from "@/lib/backend";

type Cliente = { nome: string; email: string; interruttore_attivo: boolean };

type Regola = {
  id: string;
  nome: string; // nome del processo
  attiva: boolean;
  updated_at: string;
  condizione_trigger: {
    giorniAttesa: number;
    fasciaOrariaInizio: string;
    fasciaOrariaFine: string;
    maxAzioniGiorno: number;
    contattiEsclusi: string[];
  };
};

type StatoGoogle = { collegato: boolean; aggiornataIl: string | null };

const CAMPO = "rounded border border-black/20 px-3 py-1.5 disabled:bg-zinc-100 disabled:text-zinc-500";
const BOTTONE = "rounded border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50";
const BOTTONE_PIENO = "rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50";

// useSearchParams richiede un confine Suspense attorno al componente che lo usa.
export default function PaginaImpostazioni() {
  return (
    <Suspense>
      <Impostazioni />
    </Suspense>
  );
}

// Schermata "Impostazioni" (Fase 9): interruttore generale, regole per
// processo e collegamenti. Tutti i membri leggono; solo gli admin modificano
// (lo impone il backend: qui disattiviamo solo i controlli).
function Impostazioni() {
  const backend = useBackend();
  const { organization, membership } = useOrganization();
  const orgId = organization?.id;
  const admin = membership?.role === "org:admin";
  const appenaCollegato = useSearchParams().get("google") === "collegato";

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [regole, setRegole] = useState<Regola[] | null>(null);
  const [google, setGoogle] = useState<StatoGoogle | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [nuovoProcesso, setNuovoProcesso] = useState("");
  const [versione, setVersione] = useState(0); // +1 = ricarica tutto

  useEffect(() => {
    if (!orgId) return;
    let annullato = false;
    Promise.all([
      backend<{ cliente: Cliente }>("/clienti/me"),
      backend<{ regole: Regola[] }>("/regole"),
      backend<StatoGoogle>("/auth/google/stato"),
    ])
      .then(([c, r, g]) => {
        if (annullato) return;
        setCliente(c.cliente);
        setRegole(r.regole);
        setGoogle(g);
      })
      .catch((e: Error) => {
        if (!annullato) setErrore(e.message);
      });
    return () => {
      annullato = true;
    };
  }, [backend, orgId, versione]);

  // Esegue una modifica, poi ricarica i dati dal backend.
  async function esegui(operazione: () => Promise<unknown>) {
    setOccupato(true);
    setErrore(null);
    try {
      await operazione();
      return true;
    } catch (e) {
      setErrore((e as Error).message);
      return false;
    } finally {
      setOccupato(false);
      setVersione((v) => v + 1);
    }
  }

  const impostaInterruttore = (attivo: boolean) =>
    esegui(() => backend("/clienti/me/interruttore", { method: "PATCH", body: JSON.stringify({ attivo }) }));

  // Il modulo di una regola viene ricreato dopo il salvataggio (dati freschi
  // dal backend), quindi la conferma "Salvata" la teniamo qui.
  const [salvata, setSalvata] = useState<string | null>(null);
  async function salvaRegola(processo: string, dati: object) {
    setSalvata(null);
    const ok = await esegui(() =>
      backend(`/regole?processo=${encodeURIComponent(processo)}`, { method: "POST", body: JSON.stringify(dati) }),
    );
    if (ok) setSalvata(processo);
    return ok;
  }

  async function collegaGoogle() {
    setOccupato(true);
    setErrore(null);
    try {
      const { url } = await backend<{ url: string }>("/auth/google/link", { method: "POST" });
      // Navigazione vera, non fetch: Google deve mostrare la schermata di consenso.
      window.location.href = url;
    } catch (e) {
      setErrore((e as Error).message);
      setOccupato(false);
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-zinc-600">
          Come lavora l&apos;assistente per <strong>{organization.name}</strong>.
        </p>
        {!admin && <p className="mt-1 text-sm text-zinc-500">Puoi consultare le impostazioni; solo gli amministratori possono modificarle.</p>}
      </div>

      {errore && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{errore}</p>}
      {!cliente && !errore && <p className="text-sm text-zinc-500">Caricamento...</p>}

      {cliente && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Interruttore generale</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className={`w-fit rounded px-2 py-0.5 text-xs ${cliente.interruttore_attivo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {cliente.interruttore_attivo ? "Assistente acceso" : "Assistente spento"}
              </span>
              <span className="text-zinc-600">
                {cliente.interruttore_attivo
                  ? "L'assistente puo' proporre azioni ed eseguire quelle approvate."
                  : "Nessuna nuova azione viene proposta e quelle gia' approvate non vengono eseguite."}
              </span>
            </div>
            {admin && (
              <button disabled={occupato} onClick={() => impostaInterruttore(!cliente.interruttore_attivo)} className={cliente.interruttore_attivo ? BOTTONE : BOTTONE_PIENO}>
                {cliente.interruttore_attivo ? "Spegni l'assistente" : "Accendi l'assistente"}
              </button>
            )}
          </div>
        </section>
      )}

      {regole && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-medium">Regole per processo</h2>
            <p className="text-sm text-zinc-600">Per ogni processo: quando l&apos;assistente puo&apos; proporre azioni e con quali limiti.</p>
          </div>
          {regole.length === 0 && (
            <p className="rounded border border-dashed border-black/20 p-6 text-center text-sm text-zinc-500">Nessuna regola: senza una regola l&apos;assistente non propone azioni.</p>
          )}
          {regole.map((r) => (
            <ModuloRegola key={`${r.id}-${r.updated_at}`} regola={r} admin={admin} occupato={occupato} salvata={salvata === r.nome} onSalva={(dati) => salvaRegola(r.nome, dati)} />
          ))}
          {admin && (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await salvaRegola(nuovoProcesso, {})) setNuovoProcesso("");
              }}
            >
              <label className="flex flex-1 flex-col gap-1 text-sm">
                Nuovo processo
                <input
                  value={nuovoProcesso}
                  onChange={(e) => setNuovoProcesso(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  placeholder="es. solleciti-fatture"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Solo minuscole, cifre e trattini"
                  maxLength={60}
                  required
                  className={CAMPO}
                />
              </label>
              <button type="submit" disabled={occupato} className={BOTTONE_PIENO}>
                Aggiungi regola
              </button>
            </form>
          )}
        </section>
      )}

      {google && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Collegamenti</h2>
          {appenaCollegato && google.collegato && (
            <p role="status" className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-800">Account Google collegato.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 p-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Google (Calendar)</span>
              <span className="text-zinc-600">
                {google.collegato
                  ? `Collegato${google.aggiornataIl ? ` · ultimo aggiornamento ${new Date(google.aggiornataIl).toLocaleDateString("it-IT")}` : ""}`
                  : "Non collegato: le azioni sul calendario falliranno."}
              </span>
            </div>
            {admin && (
              <div className="flex gap-2">
                <button disabled={occupato} onClick={collegaGoogle} className={google.collegato ? BOTTONE : BOTTONE_PIENO}>
                  {google.collegato ? "Ricollega" : "Collega account Google"}
                </button>
                {google.collegato && (
                  <button disabled={occupato} onClick={() => esegui(() => backend("/auth/google", { method: "DELETE" }))} className={BOTTONE}>
                    Scollega
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-black/10 p-4 text-sm">
            <span className="font-medium">Microsoft 365</span>
            <span className="text-zinc-500">Non ancora disponibile</span>
          </div>
        </section>
      )}
    </div>
  );
}

function ModuloRegola({
  regola,
  admin,
  occupato,
  salvata,
  onSalva,
}: {
  regola: Regola;
  admin: boolean;
  occupato: boolean;
  salvata: boolean;
  onSalva: (dati: object) => Promise<boolean>;
}) {
  const c = regola.condizione_trigger;
  const [attiva, setAttiva] = useState(regola.attiva);
  const [giorniAttesa, setGiorniAttesa] = useState(String(c.giorniAttesa));
  const [inizio, setInizio] = useState(c.fasciaOrariaInizio);
  const [fine, setFine] = useState(c.fasciaOrariaFine);
  const [maxAzioni, setMaxAzioni] = useState(String(c.maxAzioniGiorno));
  const [esclusi, setEsclusi] = useState(c.contattiEsclusi.join("\n"));

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSalva({
          attiva,
          giorniAttesa: Number(giorniAttesa),
          fasciaOrariaInizio: inizio,
          fasciaOrariaFine: fine,
          maxAzioniGiorno: Number(maxAzioni),
          contattiEsclusi: esclusi.split("\n").map((x) => x.trim()).filter(Boolean),
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{regola.nome}</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={attiva} disabled={!admin} onChange={(e) => setAttiva(e.target.checked)} />
          Regola attiva
        </label>
      </div>

      <fieldset disabled={!admin} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          Dalle
          <input type="time" required value={inizio} onChange={(e) => setInizio(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1">
          Alle
          <input type="time" required value={fine} onChange={(e) => setFine(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1">
          Massimo azioni al giorno
          <input type="number" required min={0} max={1000} step={1} value={maxAzioni} onChange={(e) => setMaxAzioni(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1">
          Giorni di attesa prima di agire
          <input type="number" required min={0} max={365} step={1} value={giorniAttesa} onChange={(e) => setGiorniAttesa(e.target.value)} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          Contatti esclusi (uno per riga)
          <textarea rows={3} value={esclusi} onChange={(e) => setEsclusi(e.target.value)} placeholder="nome@esempio.it" className={CAMPO} />
        </label>
      </fieldset>

      {admin && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={occupato} className={BOTTONE_PIENO}>
            Salva
          </button>
          {salvata && <span role="status" className="text-green-700">Salvata.</span>}
        </div>
      )}
    </form>
  );
}
