import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

// App Bridge reauthorize header — App Bridge catches this and does a top-level
// redirect (breaking out of the iframe) to the URL we provide.
const REAUTH_HEADER = "X-Shopify-API-Request-Failure-Reauthorize-Url";

const SHOP_TEST_QUERY = `{ shop { name } }`;

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

function isForbidden(e) {
  if (e instanceof Response) return e.status === 403 || e.status === 401;
  const code = e?.response?.code ?? e?.status;
  return code === 403 || code === 401;
}

export const loader = async ({ request }) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const url = new URL(request.url);

  // 1) Verify the access token actually has API access. A fresh token-exchange
  //    token that 403s means the store's grant for this app is missing/stale —
  //    redirect the merchant to the install/grant page to fix it in one click.
  try {
    const test = await admin.graphql(SHOP_TEST_QUERY);
    const tj = await test.json();
    if (!tj?.data?.shop) throw new Error("no shop data");
  } catch (e) {
    if (isForbidden(e)) {
      const installUrl = `https://${session.shop}/admin/oauth/install?client_id=${process.env.SHOPIFY_API_KEY}&scope=${encodeURIComponent(process.env.SCOPES || "")}`;
      console.log("Token lacks grant → redirecting to install/grant page:", installUrl);
      throw new Response(undefined, {
        status: 401,
        headers: { [REAUTH_HEADER]: installUrl },
      });
    }
    console.error("Shop test query failed (non-403):", e?.message ?? e);
  }

  // 2) Billing gate (token is valid here). Never crash if billing errors.
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
    if (e instanceof Response) throw e; // billing.request redirect
    console.error("BILLING_ERROR_DETAIL:", JSON.stringify({ message: e?.message, code: e?.response?.code, body: e?.response?.body }));
  }

  // 3) Products for the image optimizer page
  let products = [];
  if (url.pathname.includes("/product")) {
    try {
      const res = await admin.graphql(PRODUCTS_QUERY);
      const { data } = await res.json();
      products = data?.products?.edges || [];
      console.log("PRODUCTS_OK:", products.length);
    } catch (e) {
      console.error("PRODUCTS_ERROR:", e?.message ?? e);
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
