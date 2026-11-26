export const CLINOVA_MONTHLY_PRICE_EGP = 800;
export const CLINOVA_ANNUAL_PRICE_EGP = 9600;
export const CLINOVA_TRIAL_DAYS = 0;
export const CLINOVA_PLAN = "standard";

export function getSubscriptionState(subscription, now = Date.now()) {
  if (!subscription || subscription.status === "suspended") return "inactive";
  if (subscription.status !== "active") return "inactive";
  const end = Date.parse(subscription.currentPeriodEnd || "");
  if (!Number.isFinite(end)) return "inactive";
  return end > now ? "active" : "expired";
}
