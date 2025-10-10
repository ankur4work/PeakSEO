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

  return (
    <div style={{
      maxWidth: "800px",
      margin: "3rem auto",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: "2rem"
    }}>
      <h1 style={{
        textAlign: "center",
        marginBottom: "2.5rem",
        fontSize: "2.2rem",
        color: "#1c1c1c",
        letterSpacing: "1px"
      }}>
        🔍 Shopify SEO Checker & Screenshot
      </h1>

      {/* Input Card */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        padding: "1.5rem",
        boxShadow: "0 6px 18px rgba(0,0,0,0.1)",
        marginBottom: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }}>
        <label style={{ fontWeight: "600", color: "#333" }}>Store Domain</label>
        <input
          type="text"
          value={storeDomain}
          readOnly
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "#f9f9f9",
            fontSize: "1rem",
            color: "#555",
            cursor: "not-allowed"
          }}
        />
        <button
          onClick={checkSeoScore}
          disabled={loading}
          style={{
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "8px",
            border: "none",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            background: loading
              ? "#6c757d"
              : "linear-gradient(90deg, #007bff, #0056b3)",
            color: "#fff",
            transition: "all 0.3s ease"
          }}
        >
          {loading ? "⏳ Checking..." : "✅ Check SEO & Screenshot"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: "#ffe0e0",
          color: "#b00020",
          padding: "1rem 1.5rem",
          borderRadius: "8px",
          marginBottom: "2rem",
          fontWeight: "500",
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
        }}>
          ❌ {error}
        </div>
      )}

      {/* Scores */}
      {scores && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem"
        }}>
          {Object.entries(scores).map(([key, value]) => {
            const color = value >= 90 ? "#28a745" : value >= 50 ? "#ffc107" : "#dc3545";
            const emoji = value >= 90 ? "🟢" : value >= 50 ? "🟡" : "🔴";
            return (
              <div key={key} style={{
                backgroundColor: "#fff",
                borderRadius: "12px",
                padding: "1rem",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "1.8rem" }}>{emoji}</div>
                <div style={{
                  fontSize: "1rem",
                  fontWeight: "600",
                  color: "#333",
                  marginBottom: "0.5rem",
                  textTransform: "capitalize"
                }}>
                  {key === "best-practices" ? "Best Practices" : key.replace("-", " ")}
                </div>
                <div style={{
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  color: color
                }}>
                  {value}%
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
          padding: "1.5rem",
          borderRadius: "12px",
          boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
          textAlign: "center"
        }}>
          <h2 style={{ marginBottom: "1rem", color: "#333" }}>📸 Screenshot Preview</h2>
          <div style={{
            overflow: "hidden",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
          }}>
            <img
              src={screenshot}
              alt="Website Screenshot"
              style={{ width: "100%", display: "block" }}
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
