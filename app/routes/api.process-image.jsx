import { json } from "@remix-run/node";
import fetch from "node-fetch";
import sharp from "sharp";
import db from "../db.server";
import path from "path";

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

    // Extract original extension
    const originalExt = originalUrl.split('.').pop().toLowerCase();
    const isPng = originalExt === 'png';

    let processedBuffer;
    let fileExt = "";
    let mimeType = "";
    let filename = "";

    if (type === "compress") {
      // Match the original format
      if (isPng) {
        processedBuffer = await sharp(imageBuffer)
          .png({ quality: 80, compressionLevel: 9 })
          .toBuffer();
        fileExt = "png";
        mimeType = "image/png";
        filename = `compressed-${Date.now()}.png`;
      } else {
        processedBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 60, mozjpeg: true })
          .toBuffer();
        fileExt = "jpeg";
        mimeType = "image/jpeg";
        filename = `compressed-${Date.now()}.jpeg`;
      }
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
      mimeType = "image/png";
      filename = `watermarked-${Date.now()}.png`;
    } else {
      return json({ success: false, message: "❌ Unknown processing type" }, { status: 400 });
    }

    // Step 1: Request staged upload URL from Shopify
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
                resource: "PRODUCT_IMAGE",
                filename: filename,
                mimeType: mimeType,
                httpMethod: "POST",
                fileSize: processedBuffer.length.toString(),
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

    // Step 2: Upload the processed image to Shopify's staged URL using multipart/form-data
    const boundary = `----WebKitFormBoundary${Date.now()}`;
    let formDataBody = '';
    
    // Add all parameters from Shopify
    stagedTarget.parameters.forEach((param) => {
      formDataBody += `--${boundary}\r\n`;
      formDataBody += `Content-Disposition: form-data; name="${param.name}"\r\n\r\n`;
      formDataBody += `${param.value}\r\n`;
    });
    
    // Add the file
    formDataBody += `--${boundary}\r\n`;
    formDataBody += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    formDataBody += `Content-Type: ${mimeType}\r\n\r\n`;
    
    // Combine text part with binary buffer
    const textBuffer = Buffer.from(formDataBody, 'utf-8');
    const endBoundary = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullBody = Buffer.concat([textBuffer, processedBuffer, endBoundary]);

    const uploadResponse = await fetch(stagedTarget.url, {
      method: "POST",
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: fullBody,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload error:", errorText);
      return json({ 
        success: false, 
        message: `❌ Failed to upload to Shopify CDN: ${uploadResponse.statusText}` 
      }, { status: 400 });
    }

    console.log("✅ File uploaded to Shopify CDN successfully");

    // Wait for Shopify to process the uploaded file
    await new Promise((resolve) => setTimeout(resolve, 3000));

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

    await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
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

    // Wait for deletion to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 4: Create new media using the resourceUrl from staged upload
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