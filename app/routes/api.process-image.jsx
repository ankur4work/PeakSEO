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

    const session = await db.session.findFirst({ where: { shop } });
    const accessToken = session?.accessToken;
    if (!accessToken) {
      return json({ success: false, message: "Access token not found" }, { status: 401 });
    }

    // 📥 Download original image
    const originalUrl = imageSrc.split("?")[0];
    const imageResponse = await fetch(originalUrl);
    const imageBuffer = await imageResponse.buffer();

    let processedBuffer;
    let fileExt = "";
    if (type === "compress") {
      processedBuffer = await sharp(imageBuffer).jpeg({ quality: 60 }).toBuffer();
      fileExt = "jpg";
    } else if (type === "watermark") {
      let watermarkBuffer;
      if (watermarkFile && typeof watermarkFile === "object") {
        watermarkBuffer = Buffer.from(await watermarkFile.arrayBuffer());
      } else {
        const defaultWatermarkPath = path.resolve("public/watermark.png");
        watermarkBuffer = await sharp(defaultWatermarkPath).resize(100).png().toBuffer();
      }

      processedBuffer = await sharp(imageBuffer)
        .composite([{ input: watermarkBuffer, top: 10, left: 10 }])
        .png()
        .toBuffer();
      fileExt = "png";
    } else {
      return json({ success: false, message: "❌ Unknown processing type" }, { status: 400 });
    }

    // 💾 Save processed image locally
    const uploadsDir = path.resolve("public/uploads");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const fileName = `processed-${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, processedBuffer);

    const appDomain = process.env.APP_DOMAIN || `https://${shop}`;
    const fileUrl = `${appDomain}/uploads/${fileName}`;

    // 🧹 Delete old media
    const deleteMutation = `
      mutation productDeleteMedia($mediaIds: [ID!]!) {
        productDeleteMedia(mediaIds: $mediaIds) {
          deletedMediaIds
          userErrors {
            message
          }
        }
      }`;

    await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: deleteMutation, variables: { mediaIds: [mediaId] } }),
    });

    // 🚀 Upload new processed image
    const uploadMutation = `
      mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
        productCreateMedia(media: $media, productId: $productId) {
          media {
            id
            alt
            mediaContentType
          }
          mediaUserErrors {
            code
            field
            message
          }
        }
      }`;

    const uploadRes = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: uploadMutation,
          variables: {
            productId,
            media: [
              {
                originalSource: fileUrl,
                mediaContentType: "IMAGE",
              },
            ],
          },
        }),
      }
    );

    const uploadJson = await uploadRes.json();

    if (uploadJson.data?.productCreateMedia?.mediaUserErrors?.length) {
      const errMsg = uploadJson.data.productCreateMedia.mediaUserErrors[0].message;
      return json({ success: false, message: `❌ Shopify error: ${errMsg}` }, { status: 400 });
    }

    return json({
      success: true,
      message:
        type === "compress"
          ? "✅ Image compressed and replaced successfully!"
          : "✅ Watermark added and replaced successfully!",
      url: fileUrl,
    });
  } catch (err) {
    console.error("❌ Image processing error:", err);
    return json({ success: false, message: err.message }, { status: 500 });
  }
};
