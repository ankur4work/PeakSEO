// app/routes/api/process-image.jsx
import { json } from "@remix-run/node";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import db from "../db.server";

const SHOPIFY_API_VERSION = "2024-10";

export const action = async ({ request }) => {
  try {
    const formData = await request.formData();
    const mediaId = formData.get("mediaId");
    const imageSrc = formData.get("imageSrc");
    const type = formData.get("type");
    const shop = formData.get("shop");
    const productId = formData.get("productId");
    const watermarkFile = formData.get("watermark");

    if (!mediaId || !imageSrc || !type || !shop || !productId) {
      return json({ success: false, message: "❌ Missing required fields" }, { status: 400 });
    }

    // 🔐 Get access token from DB
    const session = await db.session.findFirst({ where: { shop } });
    const accessToken = session?.accessToken;
    if (!accessToken) {
      return json({ success: false, message: "Access token not found" }, { status: 401 });
    }

    // 🖼️ Fetch original image
    const originalUrl = imageSrc.split("?")[0];
    const imageResponse = await fetch(originalUrl);
    if (!imageResponse.ok) {
      return json({ success: false, message: "Failed to fetch original image" }, { status: 400 });
    }
    const imageBuffer = await imageResponse.buffer();

    let processedBuffer;
    let fileExt = "";
    let mimeType = "";

    if (type === "compress") {
      processedBuffer = await sharp(imageBuffer).jpeg({ quality: 60 }).toBuffer();
      fileExt = "jpg";
      mimeType = "image/jpeg";
    } else if (type === "watermark") {
      let watermarkBuffer;
      if (watermarkFile && typeof watermarkFile === "object") {
        watermarkBuffer = Buffer.from(await watermarkFile.arrayBuffer());
      } else {
        const defaultWatermarkPath = path.resolve("public/watermark.png");
        if (!fs.existsSync(defaultWatermarkPath)) {
          return json({ success: false, message: "Watermark image not found" }, { status: 400 });
        }
        watermarkBuffer = await sharp(defaultWatermarkPath).resize(100).png().toBuffer();
      }

      processedBuffer = await sharp(imageBuffer)
        .composite([{ input: watermarkBuffer, top: 10, left: 10 }])
        .png()
        .toBuffer();
      fileExt = "png";
      mimeType = "image/png";
    } else {
      return json({ success: false, message: "❌ Unknown processing type" }, { status: 400 });
    }

    // 📝 Save processed file
    const uploadsDir = path.resolve("public/uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `processed-${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, processedBuffer);

    // ⚠️ Shopify requires a **public URL accessible without authentication**
    const appDomain = process.env.APP_DOMAIN || `https://${shop}`;
    const fileUrl = `${appDomain}/uploads/${fileName}`;

    // 🚀 Upload to Shopify
    const uploadMutation = `
      mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media {
            alt
            mediaContentType
            status
          }
          mediaUserErrors {
            code
            message
          }
        }
      }
    `;

    const variables = {
      productId,
      media: [
        {
          originalSource: fileUrl,
          mediaContentType: "IMAGE",
        },
      ],
    };

    const shopifyResponse = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: uploadMutation, variables }),
      }
    );

    const shopifyJson = await shopifyResponse.json();

    if (shopifyJson.data?.productCreateMedia?.mediaUserErrors?.length) {
      const errMsg = shopifyJson.data.productCreateMedia.mediaUserErrors[0].message;
      return json({ success: false, message: `❌ Shopify error: ${errMsg}` }, { status: 400 });
    }

    return json({
      success: true,
      message:
        type === "compress"
          ? "✅ Image compressed and uploaded successfully!"
          : "✅ Watermark added and uploaded successfully!",
      url: fileUrl,
    });
  } catch (err) {
    console.error("❌ Image processing error:", err);
    return json({ success: false, message: err.message }, { status: 500 });
  }
};
