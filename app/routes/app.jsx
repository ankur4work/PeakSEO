import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Get shop from URL
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";

  return { 
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: shop
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
        <s-link href={`/app/product?shop=${shop}`}>Product-Page</s-link>
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