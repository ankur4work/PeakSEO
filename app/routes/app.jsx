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

  // Billing gate — but NEVER crash the app if the billing API errors.
  // Capture the full error so we can diagnose the 403.
  try {
    const check = await billing.check({ plans: [PLAN_MONTHLY], isTest: true });
    if (!check.hasActivePayment) {
      await billing.request({
        plan: PLAN_MONTHLY,
        isTest: true,
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
      });
    }
  } catch (e) {
    // billing.request throws a redirect Response — that must propagate
    if (e instanceof Response) throw e;
    // Real API error — log full detail and let the merchant in (don't block features)
    console.error(
      "BILLING_ERROR_DETAIL:",
      JSON.stringify({
        message: e?.message,
        code: e?.response?.code,
        statusText: e?.response?.statusText,
        body: e?.response?.body,
      })
    );
  }

  // Load products for the image optimizer page
  let products = [];
  if (url.pathname.includes("/product")) {
    try {
      const res = await admin.graphql(PRODUCTS_QUERY);
      const { data } = await res.json();
      products = data?.products?.edges || [];
      console.log("PRODUCTS_OK:", products.length);
    } catch (e) {
      console.error("PRODUCTS_ERROR:", JSON.stringify(e?.response?.body ?? e?.message));
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
