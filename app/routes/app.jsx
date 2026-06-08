import { useEffect } from "react";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

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

  const installUrl = `https://${session.shop}/admin/oauth/install?client_id=${process.env.SHOPIFY_API_KEY}`;

  // 1) Verify the token has API access. A fresh token that 403s = the store
  //    hasn't granted this app's scopes. Surface a one-click grant screen.
  let needsGrant = false;
  try {
    const test = await admin.graphql(SHOP_TEST_QUERY);
    const tj = await test.json();
    if (!tj?.data?.shop) needsGrant = true;
  } catch (e) {
    if (isForbidden(e)) needsGrant = true;
    else console.error("Shop test failed (non-403):", e?.message ?? e);
  }

  if (needsGrant) {
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session.shop,
      products: [],
      needsGrant: true,
      installUrl,
    };
  }

  // 2) Billing gate — never crash if billing API errors
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
    if (e instanceof Response) throw e;
    console.error("BILLING_ERROR_DETAIL:", JSON.stringify({ message: e?.message, code: e?.response?.code, body: e?.response?.body }));
  }

  // 3) Products for image optimizer
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
    needsGrant: false,
    installUrl: null,
  };
};

function GrantScreen({ installUrl }) {
  useEffect(() => {
    // App Bridge 4 intercepts open(_top) to break out of the iframe.
    try { open(installUrl, "_top"); } catch (_) {}
  }, [installUrl]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#0a1628,#112240,#0d2a1a)",
      fontFamily: "'Inter',-apple-system,sans-serif", padding: "2rem",
    }}>
      <div style={{
        maxWidth: "440px", textAlign: "center", background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "2.5rem",
      }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔐</div>
        <h1 style={{ color: "#fff", fontSize: "1.4rem", margin: "0 0 0.75rem" }}>One-time permission needed</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 1.75rem" }}>
          PeakSEO needs your approval to read and optimize your store's products. Click below to approve — it takes one click.
        </p>
        <a href={installUrl} target="_top" style={{
          display: "inline-block", textDecoration: "none",
          background: "linear-gradient(135deg,#22c55e,#10b981)", color: "#fff",
          fontWeight: 700, fontSize: "1rem", padding: "0.85rem 2rem", borderRadius: "12px",
        }}>
          Approve Permissions →
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const { apiKey, shop, products, needsGrant, installUrl } = useLoaderData();

  if (needsGrant) {
    return (
      <AppProvider embedded apiKey={apiKey}>
        <GrantScreen installUrl={installUrl} />
      </AppProvider>
    );
  }

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
