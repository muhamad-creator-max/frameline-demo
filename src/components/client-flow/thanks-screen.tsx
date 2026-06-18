"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";

export function ThanksScreen({ clientName }: { clientName: string }) {
  const first = clientName.split(" ")[0] || clientName;
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", gap: 20, maxWidth: 460,
      }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          width: 76, height: 76, borderRadius: 99,
          background: "var(--accent)", boxShadow: "var(--glow)",
          color: "var(--accent-contrast)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Check size={36} strokeWidth={2.4} />
      </motion.div>
      <h1 style={{ fontSize: 30 }}>Thanks, {first}.</h1>
      <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
        Your answers were sent to the editor. They&apos;ll be in touch soon.
      </p>
      <button
        onClick={() => window.close()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "11px 18px", fontSize: 14, fontWeight: 500,
          borderRadius: "var(--r-md)",
          background: "var(--bg-2)", color: "var(--text)",
          border: "1px solid transparent", cursor: "pointer",
        }}
      >
        Close window <ArrowRight size={15} />
      </button>
    </div>
  );
}
