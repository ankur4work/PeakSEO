import { json, redirect } from "@remix-run/node";
import fetch from "node-fetch";
import db from "../db.server";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    if (!shop) return json({ products: [], error: "Missing shop parameter" });

    const session = await db.session.findFirst({ where: { shop } });
    if (!session || !session.accessToken) {
      return redirect(`/auth?shop=${shop}`); // 👈 Redirect to install if token missing
    }

    const accessToken = session.accessToken;

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
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`;

    const response = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: productQuery }),
    });

    // ❌ Handle invalid token after reinstall
    if (response.status === 401) {
      console.error("Access token expired. Removing session...");
      await db.session.deleteMany({ where: { shop } });
      return redirect(`/auth?shop=${shop}`);
    }

    if (!response.ok) {
      const text = await response.text();
      console.error("Shopify error:", text);
      throw new Error("Failed to fetch products");
    }

    const result = await response.json();
    return json({ products: result?.data?.products?.edges || [] });

  } catch (err) {
    console.error(err);
    return json({ products: [], error: err.message });
  }
};
