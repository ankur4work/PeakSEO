import prisma from "../db.server";

// Temporary verification endpoint - tests DB session + Shopify Admin API
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  // Simple guard - not a real security measure, just prevents casual access
  if (secret !== "peakseo-verify-2026") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    // 1. Check DB for sessions
    const sessions = await prisma.session.findMany({ take: 5 });
    const sessionCount = sessions.length;
    const shops = [...new Set(sessions.map(s => s.shop))];

    if (sessions.length === 0) {
      return Response.json({ error: "No sessions in DB - app not installed on any store" });
    }

    // 2. Use requested shop or most recent session
    const shopFilter = url.searchParams.get("shop");
    const filtered = shopFilter ? sessions.filter(s => s.shop === shopFilter) : sessions;
    const pool = filtered.length ? filtered : sessions;
    const session = pool.sort((a, b) => {
      const aExp = a.expires ? new Date(a.expires) : new Date(9999, 0);
      const bExp = b.expires ? new Date(b.expires) : new Date(9999, 0);
      return bExp - aExp;
    })[0];

    const { shop, accessToken, expires } = session;

    // 3. Test products query
    const productsRes = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{ products(first: 5) { edges { node { id title } } } }`,
      }),
    });
    const productsJson = await productsRes.json();
    const products = productsJson.data?.products?.edges?.map(e => e.node.title) ?? [];
    const productsError = productsJson.errors?.[0]?.message ?? null;

    // 4. Test billing check
    const billingRes = await fetch(`https://${shop}/admin/api/2025-04/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `{ currentAppInstallation { activeSubscriptions { id name status } } }`,
      }),
    });
    const billingJson = await billingRes.json();
    const subscriptions = billingJson.data?.currentAppInstallation?.activeSubscriptions ?? [];
    const billingError = billingJson.errors?.[0]?.message ?? null;

    return Response.json({
      status: "ok",
      sessionCount,
      shops,
      activeShop: shop,
      tokenExpires: expires,
      products: {
        count: products.length,
        titles: products,
        error: productsError,
      },
      billing: {
        activeSubscriptions: subscriptions,
        hasPlan: subscriptions.some(s => s.status === "ACTIVE"),
        error: billingError,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message });
  }
};
