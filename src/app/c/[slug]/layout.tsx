import type { Metadata } from "next";
import { Rubik, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider, type Locale } from "@/lib/i18n/provider";
import "@/app/globals.css";

const rubik = Rubik({
  subsets: ["latin", "arabic"],
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700"],
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = { title: "Brief", robots: { index: false, follow: false } };

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("locale")?.value as Locale) ?? "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${rubik.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <I18nProvider initialLocale={locale}>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
