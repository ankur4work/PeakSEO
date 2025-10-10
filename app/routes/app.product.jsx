import { useEffect, useState } from "react";

const SHOPIFY_APP_URL = "https://seo-beneficial-e58ffe8cc4bc.herokuapp.com/";

export default function ProductsRoute() {
  const [products, setProducts] = useState([]);
  const [shop, setShop] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [watermark, setWatermark] = useState(null);

  // Fetch products on client side
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get("shop");
    if (!shopParam) return;
    setShop(shopParam);

    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/fetch-products?shop=${shopParam}`);
        const data = await res.json();
        if (data.products) setProducts(data.products);
        else setMessage("❌ Failed to fetch products.");
      } catch (err) {
        console.error(err);
        setMessage(`❌ ${err.message}`);
      }
    };

    fetchProducts();
  }, []);

const handleClick = async (mediaId, imageSrc, type, productId) => {
  setLoadingId(mediaId);
  setMessage("");

try {
  const formData = new FormData();
  formData.append("mediaId", mediaId);
  formData.append("imageSrc", imageSrc);
  formData.append("type", type);
  formData.append("shop", shop);
  formData.append("productId", productId);

  if (type === "watermark" && watermark) {
    formData.append("watermark", watermark);
  }

  const res = await fetch("/api/process-image", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ Server error:", errorText);
    setMessage(`❌ Server error: ${res.status}`);
    return;
  }

  const data = await res.json();
  console.log("✅ Response from API:", data);

  if (data && data.success) {
    setMessage(data.message || "✅ Image processed successfully");
  } else {
    setMessage(`❌ ${data?.message || "Something went wrong"}`);
  }
} catch (err) {
  console.error("❌ Error:", err);
  setMessage(`❌ ${err.message}`);
} finally {
  setLoadingId(null);
}

};


  return (
    <div style={{ padding: 30, fontFamily: "Segoe UI", backgroundColor: "#f4f6f8" }}>
      <h1 style={{ fontSize: "28px", marginBottom: 20 }}>🖼️ Shopify Image Editor</h1>

      <div style={{
        margin: "20px 0",
        padding: 15,
        backgroundColor: "#fff",
        borderRadius: 8,
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
      }}>
        <label style={{ fontWeight: "bold", display: "block", marginBottom: 8 }}>
          Upload Watermark (Optional):
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setWatermark(e.target.files[0])}
          style={{ border: "1px solid #ccc", padding: 8, borderRadius: 4 }}
        />
      </div>

      {message && (
        <div style={{
          padding: "12px 20px",
          backgroundColor: message.startsWith("✅") ? "#d1e7dd" : "#f8d7da",
          color: message.startsWith("✅") ? "#0f5132" : "#842029",
          borderLeft: `6px solid ${message.startsWith("✅") ? "#0f5132" : "#842029"}`,
          borderRadius: 4,
          marginBottom: 20,
        }}>
          {message}
        </div>
      )}

      {products.length === 0 && <p>No products available.</p>}

      {products.map(({ node }) => {
        const media = node.media.edges[0]?.node;
        const image = media?.image;

        return (
          <div key={node.id} style={{
            border: "1px solid #ddd",
            padding: 20,
            borderRadius: 10,
            marginBottom: 25,
            backgroundColor: "#fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
          }}>
            <h3 style={{ fontSize: "20px", marginBottom: 10 }}>{node.title}</h3>
            {image ? (
              <>
                <img
                  src={image.url}
                  alt={image.altText || "Product Image"}
                  width={160}
                  style={{
                    marginBottom: 15,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    backgroundColor: "#fff"
                  }}
                />
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    disabled={loadingId === media.id}
                    onClick={() => handleClick(media.id, image.url, "compress", node.id)}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#0d6efd",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 500,
                      opacity: loadingId === media.id ? 0.7 : 1
                    }}
                  >
                    {loadingId === media.id ? "Compressing..." : "📦 Compress Image"}
                  </button>
                  <button
                    disabled={loadingId === media.id}
                    onClick={() => handleClick(media.id, image.url, "watermark", node.id)}
                    style={{
                      padding: "10px 16px",
                      backgroundColor: "#198754",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 500,
                      opacity: loadingId === media.id ? 0.7 : 1
                    }}
                  >
                    {loadingId === media.id ? "Adding watermark..." : "💧 Add Watermark"}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ color: "#888" }}>No image found for this product.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
