export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        color: "#ffffff",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div
          style={{
            fontSize: "4rem",
            marginBottom: "1rem",
          }}
        >
          🗳️
        </div>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            marginBottom: "0.5rem",
            background: "linear-gradient(135deg, #F4A800, #FFD700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          UNI-VOTE
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            color: "#94a3b8",
            marginBottom: "2rem",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Plateforme de Vote Institutionnelle
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "9999px",
            background: "rgba(244, 168, 0, 0.15)",
            border: "1px solid rgba(244, 168, 0, 0.3)",
            color: "#F4A800",
            fontSize: "0.875rem",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#22c55e",
              animation: "pulse 2s infinite",
            }}
          />
          Phase 1 — Infrastructure en place
        </div>
      </div>
    </main>
  );
}
