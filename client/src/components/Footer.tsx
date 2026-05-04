import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="relative bg-[#0B0F19] border-t border-white/10 mt-20 overflow-hidden">

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            left: "10%",
            bottom: "-60px",
            width: "320px",
            height: "160px",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 70%)",
            filter: "blur(32px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "8%",
            bottom: "-40px",
            width: "240px",
            height: "120px",
            background: "radial-gradient(ellipse, rgba(139,92,246,0.10) 0%, transparent 70%)",
            filter: "blur(28px)",
          }}
        />
        {/* Subtle grid texture */}
        <svg
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.025,
          }}
        >
          <defs>
            <pattern id="footer-grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0 L0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#footer-grid)" />
        </svg>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-8">

        {/* Top section: Brand left, tagline right */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "2rem",
            marginBottom: "2.5rem",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
             <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-md rounded-full group-hover:bg-primary/50 transition" />
                <Shield className="relative h-6 w-6 text-primary" strokeWidth={2.2} />
              </div>
              <span className="font-bold text-base tracking-tight">
                Fin<span className="text-gradient-primary">Shield</span>
                <span className="ml-0.5 text-[10px] font-mono text-muted-foreground align-super">AI</span>
              </span>
            </Link>

            {/* Status badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.2rem 0.65rem",
                borderRadius: "9999px",
                border: "1px solid rgba(99,102,241,0.25)",
                background: "rgba(99,102,241,0.07)",
                width: "fit-content",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#34d399",
                  display: "inline-block",
                  boxShadow: "0 0 6px #34d399",
                  animation: "pulse-dot 2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  color: "#9ca3af",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Privacy-First Pipeline
              </span>
            </div>
          </div>

          {/* Description */}
          <p
            style={{
              color: "#6b7280",
              fontSize: "0.8rem",
              maxWidth: "380px",
              lineHeight: "1.7",
              fontFamily: "'IBM Plex Sans', sans-serif",
              borderLeft: "1px solid rgba(255,255,255,0.07)",
              paddingLeft: "1.5rem",
            }}
          >
            Privacy-first data masking pipeline for structured and unstructured datasets.
            Designed to support safe AI experimentation without exposing sensitive information.
          </p>
        </div>

        {/* Divider with glow */}
        <div
          style={{
            position: "relative",
            height: "1px",
            marginBottom: "1.5rem",
            background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.3) 30%, rgba(167,139,250,0.3) 70%, transparent 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "80px",
              height: "1px",
              background: "linear-gradient(90deg, transparent, #818cf8, transparent)",
              filter: "blur(2px)",
            }}
          />
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <p
            style={{
              color: "#4b5563",
              fontSize: "0.7rem",
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            Built for the{" "}
            <span style={{ color: "#6366f1" }}>Blostem AI Builder Hackathon</span>
            {" "}· Focused on real-world fintech data privacy
          </p>
          <p
            style={{
              color: "#374151",
              fontSize: "0.65rem",
              fontFamily: "monospace",
              letterSpacing: "0.06em",
            }}
          >
            © {new Date().getFullYear()} FinShield
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </footer>
  );
}