
import { json } from "@remix-run/node";

export async function action({ request }) {
  try {
    const { url } = await request.json();
    if (!url) throw new Error("URL is required");

    // Use Apiflash or any working screenshot API
    const apiKey = "AIzaSyBD53zUf_82qIn79_Na8J8yibhS0Ch8AWk"; // replace with your API key
    const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${apiKey}&url=${encodeURIComponent(
      url
    )}&full_page=true&format=png`;

    return json({ success: true, screenshotUrl });
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}






