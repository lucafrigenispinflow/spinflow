import Stripe from "stripe";

// The SDK pins apiVersion to its own latest literal; we intentionally use
// 2024-04-10 (valid at runtime) so derive the field type and cast to it.
type StripeApiVersion = NonNullable<
  ConstructorParameters<typeof Stripe>[1]
>["apiVersion"];

// Fallback key so importing this module never throws when Stripe isn't
// configured yet (every route guards on STRIPE_SECRET_KEY before calling it).
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_unconfigured",
  { apiVersion: "2024-04-10" as unknown as StripeApiVersion }
);

export type PlanKey = "free" | "pro" | "studio";

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    price_id: undefined as string | undefined,
    sessions_per_month: 5,
    features: ["5 sessioni al mese", "Template suggeriti", "Player Spotify"],
  },
  pro: {
    name: "Pro",
    price: 9.9,
    price_id: process.env.STRIPE_PRO_PRICE_ID,
    sessions_per_month: -1, // unlimited
    features: [
      "Sessioni illimitate",
      "Libreria personale",
      "Template personali",
      "PDF export",
      "Personalizzazione AI (coming soon)",
    ],
  },
  studio: {
    name: "Studio",
    price: 29.9,
    price_id: process.env.STRIPE_STUDIO_PRICE_ID,
    sessions_per_month: -1,
    features: [
      "Tutto di Pro",
      "Profili multipli istruttori",
      "Priorità supporto",
      "Early access nuove feature",
    ],
  },
} as const;

// Map a Stripe price id back to a plan key (used by the webhook).
export function planFromPriceId(priceId: string | null | undefined): PlanKey {
  if (priceId && priceId === PLANS.pro.price_id) return "pro";
  if (priceId && priceId === PLANS.studio.price_id) return "studio";
  return "free";
}
