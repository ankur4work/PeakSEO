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

/* --------------------------------
   GraphQL Queries & Mutations
-------------------------------- */
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
}`;

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

/* --------------------------------
   Loader → Fetch Products
-------------------------------- */
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

/* --------------------------------
   Helpers (server-side)
-------------------------------- */
async function fileToBuffer(fileLike) {
  if (!fileLike) return null;
  if (typeof fileLike.arrayBuffer === "function") {
    const ab = await fileLike.arrayBuffer();
    return Buffer.from(ab);
  }
  if (typeof fileLike.stream === "function") {
    const stream = fileLike.stream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(fileLike)) return fileLike;
  throw new Error("Cannot read uploaded file.");
}

/* --------------------------------
   Action → Compress / Watermark
-------------------------------- */
export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const { mediaId: sentMediaId, type, shop, productId } = Object.fromEntries(formData.entries());
    const watermarkFile = formData.get("watermark");

    if (!type || !shop || !productId) throw new Error("Missing required fields.");

    const session = await db.session.findFirst({ where: { shop } });
    const accessToken = session?.accessToken;
    if (!accessToken) throw new Error("Access token not found.");

    // 1) Get latest product image
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
    if (!currentImageUrl) throw new Error("No product image found.");

    // 2) Download current image
    const cleanUrl = currentImageUrl.split("?")[0];
    const imageResponse = await fetch(cleanUrl);
    if (!imageResponse.ok) throw new Error("Failed to download image.");
    const imageBuffer = await imageResponse.buffer();

    // 3) Prepare watermark buffer if needed
    let watermarkBuffer = null;
    if (type === "watermark") {
      if (watermarkFile && typeof watermarkFile === "object") {
        watermarkBuffer = await fileToBuffer(watermarkFile);
      } else {
        const defaultPath = path.resolve("public/watermark.png");
        if (!fs.existsSync(defaultPath)) throw new Error("Default watermark not found.");
        watermarkBuffer = await sharp(defaultPath).resize(150).png().toBuffer();
      }
    }

    // 4) Process image & ensure correct extension
    let processedBuffer;
    let fileExt = type === "compress" ? "jpg" : "png";

    if (type === "compress") {
      processedBuffer = await sharp(imageBuffer).jpeg({ quality: 50 }).toBuffer();
    } else {
      processedBuffer = await sharp(imageBuffer)
        .composite([{ input: watermarkBuffer, gravity: "southeast", dx: 16, dy: 16 }])
        .png()
        .toBuffer();
    }

    // 5) Save locally for upload
    const uploadsDir = path.resolve("public/uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `processed-${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, processedBuffer);
    const publicImageUrl = `${APP_DOMAIN}uploads/${fileName}`;

    // 6) Delete old media
    if (currentMediaId) {
      await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
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
    const uploadErrors = uploadJson?.data?.productCreateMedia?.mediaUserErrors;
    if (uploadErrors?.length) {
      throw new Error(uploadErrors.map((e) => e.message).join(", "));
    }

    return json({
      success: true,
      message: "✅ Image processed & uploaded successfully.",
      newImageUrl: publicImageUrl,
    });
  } catch (error) {
    console.error("❌ Error in image processing:", error);
    return json({ success: false, message: error.message }, { status: 500 });
  }
};

/* --------------------------------
   Component → UI
-------------------------------- */
export default function Products() {
  const { products, shop } = useLoaderData();
  const fetcher = useFetcher();
  const [productState, setProductState] = useState({});
  const [loadingProduct, setLoadingProduct] = useState(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        setProductState((prev) => ({
          ...prev,
          [fetcher.data.productId]: {
            ...(prev[fetcher.data.productId] || {}),
            processedUrl: fetcher.data.newImageUrl,
          },
        }));
        alert(fetcher.data.message);
      } else {
        alert(`❌ ${fetcher.data?.message}`);
      }
      setLoadingProduct(null);
    }
  }, [fetcher.state, fetcher.data]);

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
      {products.length === 0 && <p>No products available.</p>}
      <div className="grid">
        {products.map(({ node }) => {
          const productId = node.id;
          const media = node.media.edges[0]?.node;
          const originalImage = media?.image?.url;
          const state = productState[productId] || {};
          const currentImage = state.processedUrl || originalImage;
          return (
            <div key={productId} className="card">
              <div className="img-wrapper">
                {currentImage ? (
                  <img src={currentImage} alt={node.title} />
                ) : (
                  <div className="no-img">No image</div>
                )}
              </div>
              <div className="card-body">
                <h3>{node.title}</h3>
                <div className="uploader-row">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onWatermarkChange(productId, e.target.files[0])}
                    />
                    {state.watermarkPreview && <img src={state.watermarkPreview} alt="preview" width={60} />}
                  </div>
                  <button
                    disabled={loadingProduct === productId}
                    onClick={() => handleClick(media?.id, "compress", productId)}
                    className="btn btn-primary"
                  >
                    {loadingProduct === productId ? "Compressing..." : "📦 Compress"}
                  </button>
                  <button
                    disabled={loadingProduct === productId}
                    onClick={() => handleClick(media?.id, "watermark", productId)}
                    className="btn btn-success"
                  >
                    {loadingProduct === productId ? "Adding..." : "💧 Watermark"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .container { padding: 40px; font-family: Inter; background: #f9fafb; }
        .heading { font-size: 30px; font-weight: 700; margin-bottom: 30px; text-align: center; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
        .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
        .img-wrapper { height: 240px; display: flex; justify-content: center; align-items: center; background: #f3f4f6; margin-bottom: 12px; }
        .card img { max-width: 100%; max-height: 100%; }
        .uploader-row { display: flex; gap: 12px; align-items: center; }
        .btn { padding: 10px 14px; border: none; border-radius: 8px; color: white; cursor: pointer; }
        .btn-primary { background: #2563eb; }
        .btn-success { background: #059669; }
      `}</style>
    </div>
  );
}
