import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

const CREATE_SUBSCRIPTION = `
  mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
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

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app`;

  const res = await admin.graphql(CREATE_SUBSCRIPTION, {
    variables: { name: "PeakSEO Monthly – $30/mo", returnUrl },
  });

  const { data } = await res.json();
  const { confirmationUrl, userErrors } = data?.appSubscriptionCreate ?? {};

  if (userErrors?.length) {
    return { error: userErrors[0].message };
  }

  throw redirect(confirmationUrl);
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export default function BillingPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a1628 0%, #112240 50%, #0d2a1a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: "2rem",
    }}>
      {/* Background glows */}
      <div style={{ position: "fixed", top: "10%", left: "10%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", right: "10%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      <div style={{ maxWidth: "480px", width: "100%", position: "relative" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "64px", height: "64px", borderRadius: "16px",
            background: "linear-gradient(135deg, #22c55e, #10b981)",
            fontSize: "1.8rem", marginBottom: "1rem",
          }}>📈</div>
          <h1 style={{
            margin: 0, fontSize: "2rem", fontWeight: "800",
            background: "linear-gradient(90deg, #ffffff, #86efac)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>PeakSEO</h1>
          <p style={{ color: "#64748b", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>SEO & Image Optimization Suite</p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          padding: "2.5rem",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Monthly Plan</div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: "4px" }}>
              <span style={{ color: "#22c55e", fontSize: "1.2rem", fontWeight: "700", marginTop: "8px" }}>$</span>
              <span style={{ color: "#fff", fontSize: "4rem", fontWeight: "800", lineHeight: 1 }}>30</span>
              <span style={{ color: "#64748b", fontSize: "0.9rem", alignSelf: "flex-end", paddingBottom: "8px" }}>/month</span>
            </div>
          </div>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
            {[
              "Full Lighthouse SEO Audits",
              "Performance, Accessibility & Best Practices Scores",
              "Automatic Store SEO Analysis",
              "Product Image Compression",
              "Watermark Branding on Images",
              "Page Screenshot Capture",
              "Priority Support",
            ].map(feature => (
              <div key={feature} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #22c55e, #10b981)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", color: "#fff", fontWeight: "900",
                }}>✓</div>
                <span style={{ color: "#cbd5e1", fontSize: "0.875rem" }}>{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <form method="post">
            <button type="submit" style={{
              width: "100%", padding: "1rem", fontSize: "1rem", fontWeight: "700",
              border: "none", borderRadius: "12px", cursor: "pointer",
              background: "linear-gradient(135deg, #22c55e, #10b981)",
              color: "#fff", letterSpacing: "0.02em",
              boxShadow: "0 4px 20px rgba(34,197,94,0.3)",
              transition: "opacity 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Subscribe — $30 / month
            </button>
          </form>

          <p style={{ textAlign: "center", color: "#475569", fontSize: "0.75rem", marginTop: "1rem", marginBottom: 0 }}>
            Billed through Shopify · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
