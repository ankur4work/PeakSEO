import { json } from "@remix-run/node";

export async function action({ request }) {
  try {
    const { url } = await request.json();
    if (!url) throw new Error("URL is required");

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch website");

    const html = await response.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "No title found";

    const descMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["'](.*?)["']\s*\/?>/i
    );
    const description = descMatch ? descMatch[1] : "No description found";

    let seoScore = 50;
    if (title.length > 20) seoScore += 20;
    if (description.length > 50) seoScore += 20;
    if (html.includes("<h1")) seoScore += 10;

    return json({ success: true, data: { title, description, seoScore } });
  } catch (err) {
    return json({ success: false, error: err.message }, { status: 400 });
  }
}
