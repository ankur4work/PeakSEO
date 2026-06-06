import { Outlet, useLoaderData, useRouteError, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

const CHECK_BILLING = `{
  currentAppInstallation {
    activeSubscriptions { id name status }
  }
}`;

const CREATE_SUBSCRIPTION = (returnUrl) => `
  mutation {
    appSubscriptionCreate(
      name: "PeakSEO Monthly"
      returnUrl: "${returnUrl}"
      test: true
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: "30.00", currencyCode: USD }
            interval: EVERY_30_DAYS
          }
        }
      }]
    ) {
      appSubscription { id status }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

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
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  // Billing check — same admin instance, no second authenticate.admin call
  let hasPlan = false;
  try {
    const res = await admin.graphql(CHECK_BILLING);
    const { data } = await res.json();
    const active = data?.currentAppInstallation?.activeSubscriptions ?? [];
    hasPlan = active.some(s => s.status === "ACTIVE");
    console.log("Billing check — active subs:", active.length, "hasPlan:", hasPlan);
  } catch (e) {
    console.error("Billing check failed:", e?.message ?? e);
    hasPlan = false;
  }

  if (!hasPlan) {
    const returnUrl = `${process.env.SHOPIFY_APP_URL}/app`;
    let confirmationUrl = null;
    try {
      const res = await admin.graphql(CREATE_SUBSCRIPTION(returnUrl));
      const { data } = await res.json();
      const result = data?.appSubscriptionCreate ?? {};
      if (result.userErrors?.length) {
        console.error("Subscription create errors:", result.userErrors);
      } else {
        confirmationUrl = result.confirmationUrl ?? null;
      }
    } catch (e) {
      console.error("Subscription create failed:", e?.message ?? e);
    }
    if (confirmationUrl) throw redirect(confirmationUrl);
  }

  // Fetch products here if on product page — avoids second authenticate.admin in child loader
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
