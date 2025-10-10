import { json } from "@remix-run/node";
import fetch from "node-fetch";
import db from "../db.server";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    if (!shop) return json({ products: [] });

    const session = await db.session.findFirst({ where: { shop } });
    const accessToken = session?.accessToken;
    if (!accessToken) return json({ products: [] });

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
