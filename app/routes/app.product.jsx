import { useEffect, useState } from "react";
import { useOutletContext } from "react-router";

export default function ProductsRoute() {
  const { shop } = useOutletContext();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [watermark, setWatermark] = useState(null);

  useEffect(() => {
    if (shop) fetchProducts();
  }, [shop]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fetch-products`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load products." });
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (mediaId, imageSrc, type, productId) => {
    setLoadingId(mediaId);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("mediaId", mediaId);
      formData.append("imageSrc", imageSrc);
      formData.append("type", type);
      formData.append("shop", shop);
      formData.append("productId", productId);
      if (type === "watermark" && watermark) formData.append("watermark", watermark);

      const res = await fetch("/api/process-image", { method: "POST", body: formData });
      const data = await res.json();
      setMessage({ type: data.success ? "success" : "error", text: data.message });
      if (data.success) setTimeout(fetchProducts, 2000);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", fontFamily: "'Inter', -apple-system, sans-serif" }}>

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0a1628 0%, #112240 60%, #1a0a28 100%)",
        padding: "2rem 2.5rem",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", background: "radial-gradient(circle, rgba(240,147,251,0.15) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "relative", maxWidth: "1000px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "800", background: "linear-gradient(90deg, #fff, #f093fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Image Optimizer
            </h1>
            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
              Compress and watermark your product images
            </p>
          </div>

          {/* Watermark upload */}
          <label style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            background: "rgba(255,255,255,0.07)", border: "1px dashed rgba(255,255,255,0.2)",
            borderRadius: "12px", padding: "0.75rem 1.25rem", cursor: "pointer",
            transition: "background 0.2s",
          }}>
            <span style={{ fontSize: "1.2rem" }}>💧</span>
            <div>
              <div style={{ color: "#fff", fontSize: "0.82rem", fontWeight: "600" }}>
                {watermark ? watermark.name : "Upload Watermark"}
              </div>
              <div style={{ color: "#64748b", fontSize: "0.72rem" }}>Optional — PNG recommended</div>
            </div>
            <input type="file" accept="image/*" onChange={e => setWatermark(e.target.files[0])} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem" }}>

        {/* Toast message */}
        {message && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.75rem",
            padding: "1rem 1.25rem", borderRadius: "12px", marginBottom: "1.5rem",
            background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: message.type === "success" ? "#166534" : "#991b1b",
            fontWeight: "500", fontSize: "0.875rem",
          }}>
            <span>{message.type === "success" ? "✅" : "❌"}</span>
            {message.text}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: "#fff", borderRadius: "16px", overflow: "hidden", border: "1px solid #f1f5f9" }}>
                <div style={{ height: "200px", background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ height: "16px", borderRadius: "8px", background: "#f1f5f9", marginBottom: "0.75rem", width: "70%" }} />
                  <div style={{ height: "36px", borderRadius: "8px", background: "#f1f5f9" }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", borderRadius: "16px", border: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🖼️</div>
            <h3 style={{ margin: "0 0 0.5rem", color: "#0f172a", fontWeight: "700" }}>No products found</h3>
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Add products to your store to start optimizing images.</p>
          </div>
        )}

        {/* Product grid */}
        {!loading && products.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
            {products.map(({ node }) => {
              const media = node.media.edges[0]?.node;
              const image = media?.image;
              const isProcessing = loadingId === media?.id;

              return (
                <div key={node.id} style={{
                  background: "#fff", borderRadius: "16px", overflow: "hidden",
                  border: "1px solid #f1f5f9",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  display: "flex", flexDirection: "column",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)"; }}
                >
                  {/* Image */}
                  <div style={{ position: "relative", height: "200px", background: "#f8fafc", overflow: "hidden" }}>
                    {image ? (
                      <img
                        src={`${image.url}?t=${Date.now()}`}
                        alt={image.altText || node.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "2rem" }}>📷</div>
                    )}
                    {isProcessing && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: "600" }}>Processing...</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div style={{ padding: "1rem 1.25rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: "600", color: "#0f172a", lineHeight: "1.4",
                      overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {node.title}
                    </h3>

                    {image ? (
                      <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleClick(media.id, image.url, "compress", node.id)}
                          style={{
                            flex: 1, padding: "0.6rem 0", fontSize: "0.8rem", fontWeight: "600",
                            border: "none", borderRadius: "8px", cursor: isProcessing ? "not-allowed" : "pointer",
                            background: isProcessing ? "#e2e8f0" : "linear-gradient(135deg, #667eea, #764ba2)",
                            color: isProcessing ? "#94a3b8" : "#fff", transition: "opacity 0.2s",
                          }}
                        >📦 Compress</button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleClick(media.id, image.url, "watermark", node.id)}
                          style={{
                            flex: 1, padding: "0.6rem 0", fontSize: "0.8rem", fontWeight: "600",
                            border: "none", borderRadius: "8px", cursor: isProcessing ? "not-allowed" : "pointer",
                            background: isProcessing ? "#e2e8f0" : "linear-gradient(135deg, #f093fb, #f5576c)",
                            color: isProcessing ? "#94a3b8" : "#fff", transition: "opacity 0.2s",
                          }}
                        >💧 Watermark</button>
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.8rem" }}>No image available</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
