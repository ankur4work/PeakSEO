import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

const PRODUCTS_QUERY = `{
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
                image { url altText }
              }
            }
          }
        }
      }
    }
  }
}`;

export const loader = async ({ request }) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const url = new URL(request.url);

  // Gate the app behind an active $30/month subscription.
  // billing.require() checks for an active payment; on failure it calls
  // billing.request() which throws a redirect that breaks OUT of the iframe
  // (via /auth/exit-iframe) to the Shopify-hosted billing confirmation page.
  await billing.require({
    plans: [PLAN_MONTHLY],
    isTest: true,
    onFailure: async () =>
      billing.request({
        plan: PLAN_MONTHLY,
        isTest: true,
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
      }),
  });

  // Fetch products in this single authenticated loader (avoids a second
  // authenticate.admin call in the child route, which caused 403 races).
  let products = [];
  if (url.pathname.includes("/product")) {
    try {
      const res = await admin.graphql(PRODUCTS_QUERY);
      const { data } = await res.json();
      products = data?.products?.edges || [];
      console.log("Products fetched:", products.length);
    } catch (e) {
      console.error("Products fetch failed:", e?.message ?? e);
    }
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    products,
  };
};

export default function App() {
  const { apiKey, shop, products } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href={`/app/seo?shop=${shop}`}>Seo</s-link>
        <s-link href={`/app/product?shop=${shop}`}>Image-Optimizer</s-link>
      </s-app-nav>
      <Outlet context={{ shop, products }} />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
