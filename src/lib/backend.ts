"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

// Indirizzo del backend assistente-core. In locale e' sempre la porta 3001,
// quindi il default basta; in produzione va impostato NEXT_PUBLIC_BACKEND_URL.
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001").replace(/\/+$/, "");

export class ErroreBackend extends Error {
  constructor(
    public readonly stato: number,
    messaggio: string,
  ) {
    super(messaggio);
  }
}

// Chiamate al backend con il token di sessione Clerk dell'utente. Il backend
// ricava da quel token l'organizzazione attiva e quindi il cliente: il
// cruscotto non manda mai un clienteId.
export function useBackend() {
  const { getToken } = useAuth();
  // getToken cambia identita' a ogni render: lo teniamo in un ref, cosi' la
  // funzione restituita resta stabile e non fa ripartire gli useEffect che la
  // usano (altrimenti: richiesta -> render -> nuova funzione -> richiesta...).
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  return useCallback(
    async <T,>(percorso: string, init: RequestInit = {}): Promise<T> => {
      const token = await getTokenRef.current();
      if (!token) throw new ErroreBackend(401, "Non sei autenticato.");

      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

      const risposta = await fetch(`${BACKEND_URL}${percorso}`, { ...init, headers });
      const dati = await risposta.json().catch(() => null);
      if (!risposta.ok) {
        throw new ErroreBackend(risposta.status, dati?.message ?? `Errore ${risposta.status}`);
      }
      return dati as T;
    },
    [],
  );
}
