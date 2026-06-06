import sharp from "sharp";
import { authenticate } from "../shopify.server";

const API_VERSION = "2025-04";

export const action = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const { shop, accessToken } = session;

    const formData = await request.formData();
    const mediaId = formData.get("mediaId");
    const imageSrc = formData.get("imageSrc");
    const type = formData.get("type");
    const productId = formData.get("productId");
    const watermarkFile = formData.get("watermark");

    if (!mediaId || !imageSrc || !type || !productId) {
      return Response.json({ success: false, message: "❌ Missing required fields" }, { status: 400 });
    }

    // Download original image
    const originalUrl = imageSrc.split("?")[0];
    const imageResponse = await fetch(originalUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const isPng = originalUrl.split('.').pop().toLowerCase() === 'png';

    let processedBuffer, mimeType, filename;

    if (type === "compress") {
      if (isPng) {
        processedBuffer = await sharp(imageBuffer).png({ quality: 80, compressionLevel: 9 }).toBuffer();
        mimeType = "image/png"; filename = `compressed-${Date.now()}.png`;
      } else {
        processedBuffer = await sharp(imageBuffer).jpeg({ quality: 60, mozjpeg: true }).toBuffer();
        mimeType = "image/jpeg"; filename = `compressed-${Date.now()}.jpg`;
      }
    } else if (type === "watermark") {
      const meta = await sharp(imageBuffer).metadata();
      const wmMaxWidth = Math.min(Math.floor(meta.width * 0.2), 300);

      let wmBuffer;
      if (watermarkFile && typeof watermarkFile === "object") {
        wmBuffer = await sharp(Buffer.from(await watermarkFile.arrayBuffer()))
          .resize(wmMaxWidth, null, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      } else {
        wmBuffer = await sharp({
          create: { width: wmMaxWidth, height: Math.floor(wmMaxWidth / 4), channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.5 } }
        }).png().toBuffer();
      }

      const wmMeta = await sharp(wmBuffer).metadata();
      processedBuffer = await sharp(imageBuffer).composite([{
        input: wmBuffer,
        top: Math.max(10, meta.height - wmMeta.height - 10),
        left: Math.max(10, meta.width - wmMeta.width - 10),
      }]).png().toBuffer();
      mimeType = "image/png"; filename = `watermarked-${Date.now()}.png`;
    } else {
      return Response.json({ success: false, message: "❌ Unknown type" }, { status: 400 });
    }

    const gql = (query, variables) => fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    }).then(r => r.json());

    // Stage upload
    const staged = await gql(`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }`, { input: [{ resource: "IMAGE", filename, mimeType, httpMethod: "POST" }] });

    if (staged.data?.stagedUploadsCreate?.userErrors?.length)
      return Response.json({ success: false, message: `❌ ${staged.data.stagedUploadsCreate.userErrors[0].message}` }, { status: 400 });

    const target = staged.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) return Response.json({ success: false, message: "❌ No staged upload target" }, { status: 400 });

    // Upload to staged URL
    const boundary = `----Boundary${Date.now()}`;
    const parts = target.parameters.map(p =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`
    );
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`);
    const body = Buffer.concat([Buffer.from(parts.join(""), "utf-8"), processedBuffer, Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8")]);

    const uploadRes = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": body.length.toString() },
      body,
    });
    if (!uploadRes.ok) return Response.json({ success: false, message: `❌ Upload failed: ${uploadRes.statusText}` }, { status: 400 });

    await new Promise(r => setTimeout(r, 2000));

    // Delete old media
    await gql(`mutation productDeleteMedia($mediaIds: [ID!]!, $productId: ID!) {
      productDeleteMedia(mediaIds: $mediaIds, productId: $productId) { deletedMediaIds userErrors { message } }
    }`, { mediaIds: [mediaId], productId });

    await new Promise(r => setTimeout(r, 1000));

    // Create new media
    const created = await gql(`mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
      productCreateMedia(media: $media, productId: $productId) {
        media { id ... on MediaImage { image { url } } }
        mediaUserErrors { message }
      }
    }`, { productId, media: [{ originalSource: target.resourceUrl, mediaContentType: "IMAGE" }] });

    if (created.data?.productCreateMedia?.mediaUserErrors?.length)
      return Response.json({ success: false, message: `❌ ${created.data.productCreateMedia.mediaUserErrors[0].message}` }, { status: 400 });

    return Response.json({
      success: true,
      message: type === "compress" ? "✅ Image compressed successfully!" : "✅ Watermark added successfully!",
      url: created.data?.productCreateMedia?.media?.[0]?.image?.url,
    });
  } catch (err) {
    console.error("process-image error:", err.message);
    return Response.json({ success: false, message: `❌ Error: ${err.message}` }, { status: 500 });
  }
};
