import { redirect } from "next/navigation";

// Billing now lives inside Settings → Billing tab.
export default function BillingRedirect() {
  redirect("/app/settings?tab=billing");
}
