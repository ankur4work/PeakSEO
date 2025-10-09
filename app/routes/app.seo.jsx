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

    const apiKey = "AIzaSyBD53zUf_82qIn79_Na8J8yibhS0Ch8AWk"; // Pagespeed API
    const cleanUrl = url.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

    try {
      // 1️⃣ Fetch SEO data from Google Pagespeed
      const categories = ["performance", "accessibility", "best-practices", "seo"];
      const seoUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${cleanUrl}&category=${categories.join("&category=")}&key=${apiKey}`;

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

      // 2️⃣ Fetch Screenshot from Remix endpoint
      const screenshotRes = await fetch("/app/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://${cleanUrl}` }),
      });
      const screenshotData = await screenshotRes.json();
      if (screenshotData.success) setScreenshot(screenshotData.screenshotUrl);
      else console.log("Screenshot error:", screenshotData.error);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while fetching SEO score or screenshot.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "700px", margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>SEO Checker & Screenshot</h1>

      <input
        type="text"
        placeholder="Enter Shopify store URL (example.myshopify.com)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", borderRadius: "5px", border: "1px solid #ccc" }}
      />
      <button
        onClick={checkSeoScore}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.75rem",
          fontSize: "1rem",
          borderRadius: "5px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Checking..." : "Check SEO & Screenshot"}
      </button>

      {error && <div style={{ marginTop: "1rem", color: "red" }}>{error}</div>}

      {scores && (
        <div style={{ marginTop: "2rem" }}>
          <h2>SEO Scores for: {url}</h2>
          <ul>
            {Object.entries(scores).map(([key, value]) => (
              <li key={key} style={{ marginBottom: "0.5rem" }}>
                <strong>{key === "best-practices" ? "Best Practices" : key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value}%
              </li>
            ))}
          </ul>
        </div>
      )}

      {screenshot && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Screenshot Preview</h2>
          <img
            src={screenshot}
            alt="Website Screenshot"
            style={{ width: "100%", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
          />
        </div>
      )}
    </div>
  );
}
