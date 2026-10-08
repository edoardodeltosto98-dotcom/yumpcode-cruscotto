import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cruscotto · Assistente YUMPCODE",
  description: "Azioni in attesa, registro e numeri dell'assistente amministrativo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html lang="it" className="h-full antialiased">
        <body className="min-h-full flex flex-col">
          <header className="flex items-center justify-between border-b border-black/10 px-6 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold">YUMPCODE · Cruscotto</Link>
              <Show when="signed-in">
                <nav className="flex gap-4 text-sm">
                  <Link href="/approvazioni" className="hover:underline">Approvazioni</Link>
                  <Link href="/scadenze" className="hover:underline">Scadenze</Link>
                  <Link href="/numeri" className="hover:underline">Numeri</Link>
                  <Link href="/impostazioni" className="hover:underline">Impostazioni</Link>
                </nav>
              </Show>
            </div>
            <div className="flex items-center gap-4">
              <Show when="signed-in">
                <OrganizationSwitcher afterCreateOrganizationUrl="/" afterSelectOrganizationUrl="/" />
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal" />
              </Show>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
