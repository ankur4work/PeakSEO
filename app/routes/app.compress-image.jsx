import { json } from "@remix-run/node";
import sharp from "sharp";
import fetch from "node-fetch";

export async function action({ request }) {
  try {
    const { imageUrl } = await request.json();
    if (!imageUrl) throw new Error("Image URL is required");

    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();

    const compressedBuffer = await sharp(Buffer.from(buffer))
      .resize({ width: 800 }) // resize width
      .jpeg({ quality: 70 }) // compress JPEG
      .toBuffer();

    // Here, you should upload compressedBuffer back to Shopify
    // For demo, just return success
    return json({ success: true, message: "Image compressed successfully" });
  } catch (err) {
    console.error("Compress image error:", err);
    return json({ success: false, error: err.message });
  }
}
