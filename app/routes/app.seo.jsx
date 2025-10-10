import { useState } from "react";

export default function SeoChecker() {
  const [url, setUrl] = useState("");
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenshot, setScreenshot] = useState("");

  const checkSeoScore = async () => {
    setLoading(true);
    setError("");
    setScores(null);
    setScreenshot("");

    const apiKey = "AIzaSyBD53zUf_82qIn79_Na8J8yibhS0Ch8AWk";
    const cleanUrl = url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

    try {
      // Fetch SEO data and screenshot from Google Pagespeed
      const categories = ["performance", "accessibility", "best-practices", "seo"];
      const seoUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${cleanUrl}&category=${categories.join("&category=")}&screenshot=true&key=${apiKey}`;

      const res = await fetch(seoUrl);
      const data = await res.json();

      if (!data?.lighthouseResult?.categories) {
        setError("Could not fetch SEO data. Site may be protected or invalid.");
        setLoading(false);
        return;
      }

      // Extract SEO Scores
      const categoriesData = data.lighthouseResult.categories;
      const extractedScores = {};
      categories.forEach((cat) => {
        if (categoriesData[cat]) extractedScores[cat] = Math.round(categoriesData[cat].score * 100);
      });

      setScores(extractedScores);

      // Extract Screenshot from Lighthouse
      const screenshotData = data.lighthouseResult?.audits?.["final-screenshot"]?.details?.data;
      const fullPageScreenshot = data.lighthouseResult?.audits?.["screenshot-thumbnails"]?.details?.items?.[0]?.data;
      
      if (screenshotData) {
        setScreenshot(screenshotData);
      } else if (fullPageScreenshot) {
        setScreenshot(fullPageScreenshot);
      } else {
        console.log("No screenshot available from PageSpeed");
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while fetching SEO score or screenshot.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", fontFamily: "sans-serif", padding: "1rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem", color: "#333" }}>
        🔍 SEO Checker & Screenshot
      </h1>

      <input
        type="text"
        placeholder="Enter Shopify store URL (example.myshopify.com)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && checkSeoScore()}
        style={{
          width: "100%",
          padding: "0.75rem",
          marginBottom: "1rem",
          borderRadius: "5px",
          border: "1px solid #ccc",
          fontSize: "1rem",
        }}
      />
      <button
        onClick={checkSeoScore}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.75rem",
          fontSize: "1rem",
          borderRadius: "5px",
          backgroundColor: loading ? "#6c757d" : "#007bff",
          color: "#fff",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: "500",
        }}
      >
        {loading ? "⏳ Checking..." : "✅ Check SEO & Screenshot"}
      </button>

      {error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "5px",
            border: "1px solid #f5c6cb",
          }}
        >
          ❌ {error}
        </div>
      )}

      {scores && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #dee2e6",
          }}
        >
          <h2 style={{ marginBottom: "1rem", color: "#333" }}>
            📊 SEO Scores for: <span style={{ color: "#007bff" }}>{url}</span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {Object.entries(scores).map(([key, value]) => {
              const color = value >= 90 ? "#28a745" : value >= 50 ? "#ffc107" : "#dc3545";
              const emoji = value >= 90 ? "🟢" : value >= 50 ? "🟡" : "🔴";
              return (
                <li
                  key={key}
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.75rem",
                    backgroundColor: "#fff",
                    borderRadius: "5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <strong style={{ fontSize: "0.95rem" }}>
                    {emoji}{" "}
                    {key === "best-practices"
                      ? "Best Practices"
                      : key.charAt(0).toUpperCase() + key.slice(1).replace("-", " ")}
                    :
                  </strong>
                  <span
                    style={{
                      color: color,
                      fontWeight: "bold",
                      fontSize: "1.2rem",
                    }}
                  >
                    {value}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {screenshot && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ marginBottom: "1rem", color: "#333" }}>📸 Screenshot Preview</h2>
          <div
            style={{
              borderRadius: "10px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              border: "1px solid #dee2e6",
            }}
          >
            <img
              src={screenshot}
              alt="Website Screenshot"
              style={{
                width: "100%",
                display: "block",
              }}
              onError={(e) => {
                console.error("Failed to load screenshot");
                e.target.parentElement.innerHTML = "<p style='padding: 2rem; text-align: center; color: #666;'>❌ Screenshot could not be loaded</p>";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}