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

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  // Check active subscription via admin.graphql (same mechanism as product loading)
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
    try {
      const res = await admin.graphql(CREATE_SUBSCRIPTION(returnUrl));
      const { data } = await res.json();
      const { confirmationUrl, userErrors } = data?.appSubscriptionCreate ?? {};
      if (userErrors?.length) {
        console.error("Subscription create errors:", userErrors);
        // Allow access if subscription creation fails (config issue)
        return { apiKey: process.env.SHOPIFY_API_KEY || "", shop: session.shop };
      }
      if (confirmationUrl) {
        throw redirect(confirmationUrl);
      }
    } catch (e) {
      if (e instanceof Response) throw e; // re-throw the redirect
      console.error("Subscription create failed:", e?.message ?? e);
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
