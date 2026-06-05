import { useOutletContext, Link } from "react-router";

const features = [
  {
    icon: "📊",
    title: "SEO Analyzer",
    description: "Run a full Lighthouse audit — Performance, Accessibility, Best Practices & SEO scores in seconds.",
    cta: "Analyze Now",
    path: "/app/seo",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    steps: ["Go to SEO tab", "Your store domain is pre-filled", "Hit Analyze SEO"],
  },
  {
    icon: "🖼️",
    title: "Image Optimizer",
    description: "Compress product images, add watermarks, and reduce bandwidth without losing quality.",
    cta: "Optimize Images",
    path: "/app/product",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    steps: ["Go to Image-Optimizer tab", "Select products to optimize", "Choose compression or watermark"],
  },
  {
    icon: "📸",
    title: "Page Screenshots",
    description: "Capture full-page screenshots of your store for SEO records, reports, or client previews.",
    cta: "Take Screenshot",
    path: "/app/seo",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    steps: ["Run an SEO analysis first", "Scroll down to see the screenshot", "Right-click to save the image"],
  },
];

export default function Index() {
  const { shop } = useOutletContext();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f6f7f9",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Hero Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0a1628 0%, #112240 60%, #0d3320 100%)",
        padding: "3rem 2.5rem 2.5rem",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-60px", right: "-60px",
          width: "300px", height: "300px",
          background: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: "-40px", left: "20%",
          width: "200px", height: "200px",
          background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />

        <div style={{ position: "relative", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{
              background: "linear-gradient(135deg, #22c55e, #10b981)",
              borderRadius: "12px", width: "48px", height: "48px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.5rem", flexShrink: 0,
            }}>📈</div>
            <div>
              <h1 style={{
                margin: 0, fontSize: "1.9rem", fontWeight: "800", letterSpacing: "-0.5px",
                background: "linear-gradient(90deg, #ffffff, #86efac)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>PeakSEO</h1>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                {shop ? `Connected: ${shop}` : "SEO & Image Optimization Suite"}
              </p>
            </div>
          </div>

          <p style={{ color: "#94a3b8", fontSize: "1rem", margin: 0, maxWidth: "500px", lineHeight: "1.6" }}>
            Everything you need to dominate search rankings — SEO audits, image optimization, and page screenshots from one dashboard.
          </p>

          <div style={{
            display: "flex", gap: "2rem", marginTop: "2rem",
            paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.08)",
          }}>
            {[{ label: "SEO Tools", value: "3" }, { label: "Lighthouse Metrics", value: "4" }, { label: "Setup Time", value: "< 1 min" }].map(stat => (
              <div key={stat.label}>
                <div style={{ color: "#22c55e", fontWeight: "700", fontSize: "1.2rem" }}>{stat.value}</div>
                <div style={{ color: "#64748b", fontSize: "0.78rem", marginTop: "2px" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* Feature Cards */}
        <h2 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#0f172a", marginBottom: "1.25rem", marginTop: 0 }}>Tools</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: "#fff", borderRadius: "16px", overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
              border: "1px solid #f1f5f9", display: "flex", flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 30px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)"; }}
            >
              <div style={{ background: f.gradient, padding: "1.5rem 1.5rem 1rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{f.icon}</div>
                <h3 style={{ margin: 0, color: "#fff", fontWeight: "700", fontSize: "1.1rem" }}>{f.title}</h3>
              </div>

              <div style={{ padding: "1.25rem 1.5rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, color: "#475569", fontSize: "0.875rem", lineHeight: "1.6" }}>{f.description}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {f.steps.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.8rem", color: "#64748b" }}>
                      <span style={{
                        background: "#f1f5f9", color: "#6366f1", borderRadius: "50%",
                        width: "18px", height: "18px", display: "flex", alignItems: "center",
                        justifyContent: "center", fontWeight: "700", fontSize: "0.7rem", flexShrink: 0, marginTop: "1px",
                      }}>{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>

                <Link to={f.path} style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  background: f.gradient, color: "#fff", fontWeight: "600", fontSize: "0.85rem",
                  padding: "0.6rem 1rem", borderRadius: "8px", marginTop: "auto",
                  transition: "opacity 0.2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >{f.cta} →</Link>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Start Guide */}
        <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #f1f5f9", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.2rem" }}>⚡</span>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "#0f172a" }}>Quick Start</h2>
          </div>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { n: 1, title: "Analyze your SEO", desc: 'Click "Seo" in the left sidebar. Your store domain is auto-filled. Hit Analyze SEO to get your Lighthouse scores.', icon: "📊" },
              { n: 2, title: "Check your scores", desc: "Review Performance, Accessibility, Best Practices, and SEO scores. Green = great, yellow = needs work, red = fix immediately.", icon: "✅" },
              { n: 3, title: "Optimize images", desc: 'Click "Image-Optimizer" in the sidebar to compress product images or add watermarks for branding.', icon: "🖼️" },
            ].map(step => (
              <div key={step.n} style={{ display: "flex", gap: "1rem", alignItems: "flex-start", padding: "1rem", background: "#f8fafc", borderRadius: "12px" }}>
                <div style={{
                  background: "linear-gradient(135deg, #22c55e, #10b981)", color: "#fff",
                  fontWeight: "800", fontSize: "0.85rem", width: "32px", height: "32px",
                  borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{step.n}</div>
                <div>
                  <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "0.9rem", marginBottom: "0.25rem" }}>{step.icon} {step.title}</div>
                  <div style={{ color: "#64748b", fontSize: "0.82rem", lineHeight: "1.5" }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
