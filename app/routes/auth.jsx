import { redirect } from "@remix-run/node";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return redirect("/auth/login");
  }

  // Redirect merchant to Shopify OAuth install page
  return redirect(
    `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}`
  );
};
