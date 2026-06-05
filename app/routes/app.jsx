import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

const CHECK_SUBSCRIPTION = `
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Check active billing subscription
  const url = new URL(request.url);
  const isBillingPage = url.pathname === "/app/billing";

  if (!isBillingPage) {
    const res = await admin.graphql(CHECK_SUBSCRIPTION);
    const { data } = await res.json();
    const active = data?.currentAppInstallation?.activeSubscriptions ?? [];
    const hasPlan = active.some(s => s.status === "ACTIVE");

    if (!hasPlan) {
      const { redirect } = await import("react-router");
      throw redirect("/app/billing");
    }
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop
  };
};

export default function App() {
  const { apiKey, shop } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {/* <s-link href={`/app?shop=${shop}`}>Home</s-link>
        <s-link href={`/app/additional?shop=${shop}`}>additional page</s-link> */}
        <s-link href={`/app/seo?shop=${shop}`}>Seo</s-link>
        {/* <s-link href={`/app/newproduct?shop=${shop}`}>New-product-Page</s-link> */}
        <s-link href={`/app/product?shop=${shop}`}>Image-Optimizer</s-link>
      </s-app-nav>
      <Outlet context={{ shop }} />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};