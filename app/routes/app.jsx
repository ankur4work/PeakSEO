import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate, PLAN_MONTHLY } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);

  let hasPlan = true; // default to true so app stays accessible if billing API fails

  try {
    const { hasActivePayment } = await billing.check({
      plans: [PLAN_MONTHLY],
      isTest: true,
    });
    hasPlan = hasActivePayment;
  } catch (e) {
    console.error("Billing check error:", e?.response?.body ?? e?.message ?? e);
    // If billing check fails (e.g. token needs refresh), let user in
    hasPlan = true;
  }

  if (!hasPlan) {
    try {
      await billing.request({
        plan: PLAN_MONTHLY,
        isTest: true,
        returnUrl: `${process.env.SHOPIFY_APP_URL}/app`,
      });
    } catch (e) {
      console.error("Billing request error:", e?.message ?? e);
    }
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export default function App() {
  const { apiKey, shop } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href={`/app/seo?shop=${shop}`}>Seo</s-link>
        <s-link href={`/app/product?shop=${shop}`}>Image-Optimizer</s-link>
      </s-app-nav>
      <Outlet context={{ shop }} />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
