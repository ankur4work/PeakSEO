// app/routes/products.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import sharp from "sharp";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import db from "../db.server";

const APP_DOMAIN = "https://seo-beneficial-e58ffe8cc4bc.herokuapp.com/";

/* -------------------------
   GraphQL Queries & Mutations
------------------------- */
const productQuery = `
{
  products(first: 100) {
    edges {
      node {
        id
        title
        media(first: 1) {
          edges {
            node {
              ... on MediaImage {
                id
                image { url altText }
              }
            }
          }
        }
      }
    }
  }
}`;

const productMediaQuery = `
query getProductMedia($productId: ID!) {
  product(id: $productId) {
    media(first: 1) {
      edges {
        node {
          ... on MediaImage {
            id
            image { url altText }
          }
        }
      }
    }
  }
}
`;

const deleteMediaMutation = `
mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
  productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
    deletedMediaIds
    mediaUserErrors { message }
  }
}`;

const uploadMediaMutation = `
mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
  productCreateMedia(media: $media, productId: $productId) {
    media { alt mediaContentType status }
    mediaUserErrors { message }
  }
}`;

/* -------------------------
   Loader → Fetch Products
------------------------- */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const accessToken = session.accessToken;
  if (!accessToken) return json({ products: [], shop });

  const response = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query: productQuery }),
  });

  const result = await response.json();
  const products = result?.data?.products?.edges || [];
  return json({ products, shop });
};

/* -------------------------
   Helpers (server-side)
------------------------- */
async function fileToBuffer(fileLike) {
  if (!fileLike) return null;
  if (typeof fileLike.arrayBuffer === "function") {
    const ab = await fileLike.arrayBuffer();
    return Buffer.from(ab);
  }
  if (typeof fileLike.stream === "function") {
    const stream = fileLike.stream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(fileLike)) return fileLike;
  throw new Error("Cannot read uploaded file.");
}

/* -------------------------
   Action → Compress / Watermark
------------------------- */
export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const { mediaId: sentMediaId, type, shop, productId } = Object.fromEntries(formData.entries());
    const watermarkFile = formData.get("watermark");

    if (!type || !shop || !productId) {
      throw new Error("Missing required fields (type / shop / productId).");
    }

    const session = await db.session.findFirst({ where: { shop } });
    const accessToken = session?.accessToken;
    if (!accessToken) throw new Error("Access token not found.");

    // 1) Query Shopify for latest product media
    const productResp = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: productMediaQuery,
        variables: { productId },
      }),
    });

    const productJson = await productResp.json();
    const mediaNode = productJson?.data?.product?.media?.edges?.[0]?.node;
    const currentMediaId = mediaNode?.id || sentMediaId;
    const currentImageUrl = mediaNode?.image?.url;

    if (!currentImageUrl) {
      throw new Error("Could not retrieve current product image URL.");
    }

    // 2) Download current image
    const cleanUrl = currentImageUrl.split("?")[0];
    const imageResponse = await fetch(cleanUrl);
    if (!imageResponse.ok) throw new Error("Failed to fetch current product image.");
    const imageBuffer = await imageResponse.buffer();
    const originalSizeKB = (imageBuffer.length / 1024).toFixed(2);

    // 3) Prepare watermark buffer
    let watermarkBuffer = null;
    if (type === "watermark") {
      if (watermarkFile && typeof watermarkFile === "object") {
        watermarkBuffer = await fileToBuffer(watermarkFile);
      } else {
        const defaultPath = path.resolve("public/watermark.png");
        if (!fs.existsSync(defaultPath)) throw new Error("Default watermark missing.");
        watermarkBuffer = await sharp(defaultPath).resize(150).png().toBuffer();
      }
    }

    // 4) Process image
    let processedBuffer;
    let fileExt = "jpg";

    if (type === "compress") {
      processedBuffer = await sharp(imageBuffer).jpeg({ quality: 50 }).toBuffer();
      fileExt = "jpg";
    } else if (type === "watermark") {
      if (!watermarkBuffer) throw new Error("Watermark not available.");
      processedBuffer = await sharp(imageBuffer)
        .composite([{ input: watermarkBuffer, gravity: "southeast", dx: 16, dy: 16 }])
        .png()
        .toBuffer();
      fileExt = "png";
    } else {
      throw new Error("Unknown processing type.");
    }

    const processedSizeKB = (processedBuffer.length / 1024).toFixed(2);

    // 5) Save locally
    const fileName = `processed-${Date.now()}.${fileExt}`;
    const uploadsDir = path.resolve("public/uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, processedBuffer);

    const publicImageUrl = `${APP_DOMAIN}uploads/${fileName}`; // ✅ fixed URL
    console.log("👉 Public Image URL:", publicImageUrl);

    // 6) Delete old media
    if (currentMediaId) {
      const deleteResp = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: deleteMediaMutation,
          variables: { mediaIds: [currentMediaId], productId },
        }),
      });
      const deleteJson = await deleteResp.json();
      console.log("🗑️ Delete response:", JSON.stringify(deleteJson, null, 2));
    }

    // 7) Upload new media
    const uploadResp = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: uploadMediaMutation,
        variables: {
          productId,
          media: [
            {
              originalSource: publicImageUrl,
              mediaContentType: "IMAGE",
              alt: "Processed Image",
            },
          ],
        },
      }),
    });

    const uploadJson = await uploadResp.json();
    console.log("📤 Upload response:", JSON.stringify(uploadJson, null, 2));

    const uploadErrors = uploadJson?.data?.productCreateMedia?.mediaUserErrors;
    if (uploadErrors?.length) {
      throw new Error(`Upload failed: ${uploadErrors.map((e) => e.message).join(", ")}`);
    }

    return json({
      success: true,
      message: "✅ Image processed successfully.",
      originalSizeKB,
      processedSizeKB,
      productId,
      newImageUrl: publicImageUrl,
      shopifyResponse: uploadJson, // send response back also
    });
    
  } catch (error) {
    console.error("❌ Error in image processing:", error);
    return json({ success: false, message: error.message }, { status: 500 });
  }
};



/* -------------------------
   Component → Product UI
------------------------- */
export default function Products() {
  const { products, shop } = useLoaderData();
  const fetcher = useFetcher();

  // productState stores per-product info: { [productId]: { processedUrl, watermarkFile, watermarkPreview } }
  const [productState, setProductState] = useState({});
  const [loadingProduct, setLoadingProduct] = useState(null);

  // Listen to fetcher results and update productState with newImageUrl
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        const { productId, newImageUrl, originalSizeKB, processedSizeKB, message } = fetcher.data;
        // update product state processedUrl
        setProductState((prev) => ({
          ...prev,
          [productId]: {
            ...(prev[productId] || {}),
            processedUrl: newImageUrl,
          },
        }));
        alert(`${message}\nOriginal: ${originalSizeKB} KB\nProcessed: ${processedSizeKB} KB`);
      } else {
        alert(`❌ ${fetcher.data?.message}`);
      }
      setLoadingProduct(null);
    }
  }, [fetcher.state, fetcher.data]);

  // handle file input change per product (set watermark file + preview)
  const onWatermarkChange = (productId, file) => {
    const preview = file ? URL.createObjectURL(file) : null;
    setProductState((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        watermarkFile: file,
        watermarkPreview: preview,
      },
    }));
  };

  // Submit action for a product (compress or watermark)
  const handleClick = (mediaId, type, productId) => {
    const watermarkFile = productState[productId]?.watermarkFile || null;
    setLoadingProduct(productId);

    const formData = new FormData();
    formData.append("mediaId", mediaId || "");
    formData.append("productId", productId);
    formData.append("type", type);
    formData.append("shop", shop);
    if (type === "watermark" && watermarkFile) {
      formData.append("watermark", watermarkFile);
    }

    fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
  };

  return (
    <div className="container">
      <h1 className="heading">🖼️ Shopify Image Editor</h1>

      {products.length === 0 && <p className="no-products">No products available.</p>}

      <div className="grid">
        {products.map(({ node }) => {
          const productId = node.id;
          const media = node.media.edges[0]?.node;
          const originalImage = media?.image?.url;
          const state = productState[productId] || {};
          const currentImage = state.processedUrl || originalImage;
          const isProcessed = !!state.processedUrl;

          return (
            <div key={productId} className="card">
              {isProcessed && <span className="badge">✅ Processed</span>}

              <div className="img-wrapper">
                {currentImage ? (
                  <img src={currentImage} alt={media?.image?.altText || node.title} />
                ) : (
                  <div className="no-img">No image</div>
                )}
              </div>

              <div className="card-body">
                <h3 className="product-title">{node.title}</h3>

                <div className="uploader-row">
                  <div className="upload-box-inline">
                    <label className="upload-label">Watermark</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onWatermarkChange(productId, e.target.files[0])}
                    />
                    {state.watermarkPreview && (
                      <img className="watermark-preview" src={state.watermarkPreview} alt="preview" />
                    )}
                  </div>

                  <div className="btn-group">
                    <button
                      disabled={loadingProduct === productId}
                      onClick={() => handleClick(media?.id, "compress", productId)}
                      className="btn btn-primary"
                    >
                      {loadingProduct === productId && fetcher.submission?.formData?.get?.("type") === "compress"
                        ? "Compressing..."
                        : "📦 Compress"}
                    </button>

                    <button
                      disabled={loadingProduct === productId}
                      onClick={() => handleClick(media?.id, "watermark", productId)}
                      className="btn btn-success"
                    >
                      {loadingProduct === productId && fetcher.submission?.formData?.get?.("type") === "watermark"
                        ? "Adding..."
                        : "💧 Watermark"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline Styles */}
      <style>{`
        .container {
          padding: 40px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          background: #f9fafb;
        }
        .heading {
          font-size: 34px;
          font-weight: 700;
          margin-bottom: 28px;
          text-align: center;
          color: #111827;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 28px;
        }
        .card {
          position: relative;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e6e9ee;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
          overflow: hidden;
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }
        .card:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
        }
        .badge {
          position: absolute;
          top: 12px;
          left: 12px;
          background: #059669;
          color: white;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
        }
        .img-wrapper {
          width: 100%;
          height: 260px;
          background: linear-gradient(180deg, #fafafa 0%, #f3f4f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1px solid #f0f0f0;
        }
        .card img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .card-body {
          padding: 18px;
        }
        .product-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #0f172a;
          text-align: center;
        }
        .uploader-row {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .upload-box-inline {
          flex: 1;
        }
        .upload-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          display: block;
          margin-bottom: 6px;
        }
        .upload-box-inline input[type="file"] {
          display: block;
          width: 100%;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid #e6e9ee;
          cursor: pointer;
        }
        .watermark-preview {
          margin-top: 8px;
          width: 64px;
          height: 48px;
          object-fit: contain;
          border-radius: 6px;
          border: 1px solid #e6e9ee;
        }
        .btn-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
        }
        .btn {
          padding: 10px 14px;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          font-size: 14px;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-success {
          background: #059669;
          color: white;
        }
        .no-products {
          text-align: center;
          font-size: 18px;
          color: #6b7280;
        }
        .no-img {
          color: #9ca3af;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
