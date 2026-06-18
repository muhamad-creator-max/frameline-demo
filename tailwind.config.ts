import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: { "2xl": "1320px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-rubik)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Brand
        brand: {
          DEFAULT: "#00BE43",
          50: "#E6FBEE",
          100: "#C4F4D3",
          200: "#8DE9A8",
          300: "#56DD7D",
          400: "#22CF59",
          500: "#00BE43",
          600: "#009A37",
          700: "#00772B",
          800: "#00541F",
          900: "#003114",
        },
        // Frameline raw tokens — `bg-frame-surface`, `text-frame-text-2`, etc.
        frame: {
          bg: "var(--bg)",
          "bg-2": "var(--bg-2)",
          surface: "var(--surface)",
          "surface-2": "var(--surface-2)",
          text: "var(--text)",
          "text-2": "var(--text-2)",
          "text-3": "var(--text-3)",
          border: "var(--border-raw)",
          "border-2": "var(--border-2)",
          accent: "var(--accent)",
          "accent-ink": "var(--accent-ink)",
          "accent-weak": "var(--accent-weak)",
          "accent-contrast": "var(--accent-contrast)",
          danger: "var(--danger)",
        },
        // Semantic tokens (map to CSS variables — soft glow in dark mode)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        // shadcn defaults
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Frameline scale
        "fr-sm": "var(--r-sm)",
        "fr-md": "var(--r-md)",
        "fr-lg": "var(--r-lg)",
        "fr-xl": "var(--r-xl)",
      },
      boxShadow: {
        glow: "var(--glow)",
        "glow-static": "0 0 0 1px rgba(26,255,106,.25), 0 0 26px rgba(26,255,106,.30)",
        "glow-sm": "0 0 24px -8px hsl(var(--brand-glow) / 0.45)",
        "frame-sm": "var(--shadow-sm)",
        "frame-md": "var(--shadow-md)",
        "frame-lg": "var(--shadow-lg)",
      },
      // (boxShadow extended above)
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 18px -6px hsl(var(--brand-glow) / 0.35)" },
          "50%": { boxShadow: "0 0 38px -6px hsl(var(--brand-glow) / 0.7)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
