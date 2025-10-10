import { json } from "@remix-run/node";
import fetch from "node-fetch";
import sharp from "sharp";
import db from "../db.server";
import path from "path";
import fs from "fs";

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
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Extract original extension
    const originalExt = originalUrl.split('.').pop().toLowerCase();
    const isPng = originalExt === 'png';

    let processedBuffer;
    let mimeType = "";
    let filename = "";

    if (type === "compress") {
      // Match the original format
      if (isPng) {
        processedBuffer = await sharp(imageBuffer)
          .png({ quality: 80, compressionLevel: 9 })
          .toBuffer();
        mimeType = "image/png";
        filename = `compressed-${Date.now()}.png`;
      } else {
        processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 60, mozjpeg: true })
          .toBuffer();
        mimeType = "image/jpeg";
        filename = `compressed-${Date.now()}.jpg`;
      }
    } else if (type === "watermark") {
      // Get original image dimensions
      const imageMetadata = await sharp(imageBuffer).metadata();
      const imageWidth = imageMetadata.width;
      const imageHeight = imageMetadata.height;

      // Calculate watermark size (20% of image width, max 300px)
      const watermarkMaxWidth = Math.min(Math.floor(imageWidth * 0.2), 300);

      let watermarkBuffer;
      if (watermarkFile && typeof watermarkFile === "object") {
        const uploadedWatermark = Buffer.from(await watermarkFile.arrayBuffer());
        watermarkBuffer = await sharp(uploadedWatermark)
          .resize(watermarkMaxWidth, null, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
      } else {
        const defaultWatermarkPath = path.resolve("public/watermark.png");
        if (fs.existsSync(defaultWatermarkPath)) {
          watermarkBuffer = await sharp(defaultWatermarkPath)
            .resize(watermarkMaxWidth, null, { fit: 'inside', withoutEnlargement: true })
            .png()
            .toBuffer();
        } else {
          // Create a simple text watermark if file doesn't exist
          const watermarkHeight = Math.floor(watermarkMaxWidth / 4);
          watermarkBuffer = await sharp({
            create: {
              width: watermarkMaxWidth,
              height: watermarkHeight,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 0.5 }
            }
          })
          .png()
          .toBuffer();
        }
      }

      // Position watermark at bottom-right corner with 10px padding
      const watermarkMetadata = await sharp(watermarkBuffer).metadata();
      const left = imageWidth - watermarkMetadata.width - 10;
      const top = imageHeight - watermarkMetadata.height - 10;

      processedBuffer = await sharp(imageBuffer)
        .composite([{ 
          input: watermarkBuffer, 
          top: Math.max(10, top), 
          left: Math.max(10, left),
          gravity: 'southeast'
        }])
        .png()
        .toBuffer();
      mimeType = "image/png";
      filename = `watermarked-${Date.now()}.png`;
    } else {
      return json({ success: false, message: "❌ Unknown processing type" }, { status: 400 });
    }

    console.log(`Processing ${type} - File size: ${processedBuffer.length} bytes, MIME: ${mimeType}`);

    // Step 1: Create staged upload target
    const stagedUploadMutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`;

    const stagedUploadRes = await fetch(
      `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: stagedUploadMutation,
          variables: {
            input: [
              {
                resource: "IMAGE",
                filename: filename,
                mimeType: mimeType,
                httpMethod: "POST",
              },
            ],
          },
        }),
      }
    );

    const stagedUploadJson = await stagedUploadRes.json();

    if (stagedUploadJson.data?.stagedUploadsCreate?.userErrors?.length) {
      const errMsg = stagedUploadJson.data.stagedUploadsCreate.userErrors[0].message;
      return json({ success: false, message: `❌ Staged upload error: ${errMsg}` }, { status: 400 });
    }

    const stagedTarget = stagedUploadJson.data?.stagedUploadsCreate?.stagedTargets[0];
    if (!stagedTarget) {
      return json({ success: false, message: "❌ Failed to get staged upload URL" }, { status: 400 });
    }

    console.log("✅ Got staged upload URL");

    // Step 2: Upload file to staged URL
    const boundary = `----WebKitFormBoundary${Date.now()}${Math.random()}`;
    const parts = [];
    
    // Add parameters
    for (const param of stagedTarget.parameters) {
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${param.name}"\r\n\r\n` +
        `${param.value}\r\n`
      );
    }
    
    // Add file
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );
    
    const header = Buffer.from(parts.join(''), 'utf-8');
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const body = Buffer.concat([header, processedBuffer, footer]);

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body: body,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload to staged URL failed:", uploadResponse.status, errorText);
      return json({ 
        success: false, 
        message: `❌ Failed to upload: ${uploadResponse.statusText}` 
      }, { status: 400 });
    }

    console.log("✅ File uploaded to staged URL");

    // Wait for Shopify to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 3: Delete old media
    const deleteMutation = `
      mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
        productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
          deletedMediaIds
          userErrors {
            message
          }
        }
      }`;

    const deleteRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: deleteMutation,
        variables: {
          mediaIds: [mediaId],
          productId: productId,
        },
      }),
    });

    const deleteJson = await deleteRes.json();
    if (deleteJson.data?.productDeleteMedia?.userErrors?.length) {
      console.error("Delete errors:", deleteJson.data.productDeleteMedia.userErrors);
    }

    console.log("✅ Old media deleted");

    // Wait for deletion
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 4: Create new media with resourceUrl
    const uploadMutation = `
      mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
        productCreateMedia(media: $media, productId: $productId) {
          media {
            id
            alt
            mediaContentType
            ... on MediaImage {
              image {
                url
              }
            }
          }
          mediaUserErrors {
            code
            field
            message
          }
        }
      }`;

    const createMediaRes = await fetch(
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
                originalSource: stagedTarget.resourceUrl,
                mediaContentType: "IMAGE",
              },
            ],
          },
        }),
      }
    );

    const createMediaJson = await createMediaRes.json();

    if (createMediaJson.data?.productCreateMedia?.mediaUserErrors?.length) {
      const errMsg = createMediaJson.data.productCreateMedia.mediaUserErrors[0].message;
      console.error("Create media errors:", createMediaJson.data.productCreateMedia.mediaUserErrors);
      return json({ success: false, message: `❌ Shopify error: ${errMsg}` }, { status: 400 });
    }

    if (!createMediaJson.data?.productCreateMedia?.media?.length) {
      return json({
        success: false,
        message: "❌ Failed to create media in Shopify.",
      }, { status: 400 });
    }

    console.log("✅ New media created successfully");

    return json({
      success: true,
      message:
        type === "compress"
          ? "✅ Image compressed and replaced successfully!"
          : "✅ Watermark added and replaced successfully!",
      url: createMediaJson.data.productCreateMedia.media[0].image?.url,
    });
  } catch (err) {
    console.error("❌ Image processing error:", err);
    return json({ success: false, message: `❌ Error: ${err.message}` }, { status: 500 });
  }
};