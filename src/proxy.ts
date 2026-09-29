import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Fase "Autenticazione B2B multi-tenant" (Clerk). Le pagine di login/registrazione
// restano pubbliche, tutto il resto del cruscotto richiede un utente autenticato
// (e quindi un'organizzazione, per il multi-tenant).
const isRottaPubblica = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isRottaPubblica(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Salta i file interni di Next.js e gli asset statici.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
