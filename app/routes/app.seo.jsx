import { useState, useEffect } from "react";

export default function SeoChecker() {
  const [storeDomain, setStoreDomain] = useState("");
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shopParam = params.get("shop");
      const host = window.location.hostname;

      if (shopParam) setStoreDomain(shopParam);
      else if (host.includes("myshopify.com")) setStoreDomain(host);
      else setStoreDomain("example.myshopify.com");
    } catch {
      setStoreDomain("example.myshopify.com");
    }
  }, []);

  const checkSeoScore = async () => {
    setLoading(true);
    setError("");
    setScores(null);
    setScreenshot("");

    const apiKey = "AIzaSyBD53zUf_82qIn79_Na8J8yibhS0Ch8AWk";
    const cleanUrl = storeDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const categories = ["performance", "accessibility", "best-practices", "seo"];
    const seoUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${cleanUrl}&category=${categories.join("&category=")}&screenshot=true&key=${apiKey}`;

    try {
      const res = await fetch(seoUrl);
      const data = await res.json();

      if (!data?.lighthouseResult?.categories) {
        setError("Could not fetch SEO data. Site may be protected or invalid.");
        setLoading(false);
        return;
      }

      const categoriesData = data.lighthouseResult.categories;
      const extractedScores = {};
      categories.forEach((cat) => {
        if (categoriesData[cat]) extractedScores[cat] = Math.round(categoriesData[cat].score * 100);
      });
      setScores(extractedScores);

      const screenshotData = data.lighthouseResult?.audits?.["final-screenshot"]?.details?.data;
      const fullPageScreenshot = data.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.[0]?.data;
      setScreenshot(screenshotData || fullPageScreenshot || "");

      setLoading(false);
    } catch {
      setError("Something went wrong while fetching SEO score or screenshot.");
      setLoading(false);
    }
  };

  const getBarColor = (score) =>
    score >= 90 ? "#28a745" : score >= 50 ? "#ffc107" : "#dc3545";

  return (
    <div style={{
      maxWidth: "1000px",
      margin: "3rem auto",
      fontFamily: "'Poppins', sans-serif",
      padding: "2rem",
      color: "#1a1a1a"
    }}>
      {/* Header */}
      <div style={{
        textAlign: "center",
        marginBottom: "3rem"
      }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700" }}>🔍 Shopify SEO Dashboard</h1>
        <p style={{ color: "#555", marginTop: "0.5rem" }}>
          Analyze your store SEO and get a preview screenshot
        </p>
      </div>

      {/* Input Card */}
      <div style={{
        background: "linear-gradient(145deg, #f0f4ff, #d9e4ff)",
        borderRadius: "15px",
        padding: "2rem",
        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        marginBottom: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }}>
        <label style={{ fontWeight: "600", color: "#333", fontSize: "1rem" }}>Store Domain</label>
        <input
          type="text"
          value={storeDomain}
          readOnly
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "#e6ecff",
            fontSize: "1rem",
            fontWeight: "500",
            cursor: "not-allowed"
          }}
        />
        <button
          onClick={checkSeoScore}
          disabled={loading}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "10px",
            border: "none",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading
              ? "#6c757d"
              : "linear-gradient(90deg, #4facfe, #00f2fe)",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: "0.3s all",
          }}
        >
          {loading ? "⏳ Checking..." : "✅ Analyze SEO"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: "#ffe5e5",
          color: "#c70000",
          padding: "1rem 1.5rem",
          borderRadius: "10px",
          marginBottom: "2rem",
          fontWeight: "500",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          ❌ {error}
        </div>
      )}

      {/* Scores Grid */}
      {scores && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem"
        }}>
          {Object.entries(scores).map(([key, value]) => {
            const color = getBarColor(value);
            const emoji = value >= 90 ? "🟢" : value >= 50 ? "🟡" : "🔴";
            return (
              <div key={key} style={{
                backgroundColor: "#ffffff",
                borderRadius: "15px",
                padding: "1.5rem",
                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                transition: "transform 0.3s, box-shadow 0.3s",
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 12px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                }}
              >
                <div style={{ fontSize: "1.8rem", textAlign: "center" }}>{emoji}</div>
                <div style={{ textTransform: "capitalize", fontWeight: "600", textAlign: "center", color: "#333" }}>
                  {key === "best-practices" ? "Best Practices" : key.replace("-", " ")}
                </div>
                <div style={{ fontSize: "1.4rem", fontWeight: "700", color: color, textAlign: "center" }}>
                  {value}%
                </div>
                <div style={{
                  height: "10px",
                  width: "100%",
                  backgroundColor: "#e0e0e0",
                  borderRadius: "5px",
                  overflow: "hidden"
                }}>
                  <div style={{
                    height: "100%",
                    width: `${value}%`,
                    backgroundColor: color,
                    transition: "width 1.2s ease-in-out"
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot */}
      {screenshot && (
        <div style={{
          backgroundColor: "#fff",
          padding: "2rem",
          borderRadius: "15px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
          textAlign: "center",
          transition: "0.3s all",
          overflow: "hidden"
        }}>
          <h2 style={{ marginBottom: "1rem", color: "#333", fontWeight: "600" }}>📸 Screenshot Preview</h2>
          <div style={{
            borderRadius: "15px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
            display: "inline-block",
            transition: "transform 0.3s",
          }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <img
              src={screenshot}
              alt="Website Screenshot"
              style={{ width: "100%", display: "block", borderRadius: "15px" }}
              onError={(e) => {
                e.target.parentElement.innerHTML = "<p style='padding: 2rem; color: #666;'>❌ Screenshot could not be loaded</p>";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
