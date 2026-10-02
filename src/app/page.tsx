import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">YUMPCODE</p>
      <h1 className="text-3xl font-semibold tracking-tight">Cruscotto dell&apos;assistente amministrativo</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Ambiente di sviluppo pronto. Qui arriveranno le quattro schermate: azioni in attesa,
        registro, numeri del mese e impostazioni.
      </p>
      <Link href="/approvazioni" className="w-fit rounded bg-black px-4 py-2 text-sm text-white">
        Vai alle approvazioni
      </Link>
    </main>
  );
}
