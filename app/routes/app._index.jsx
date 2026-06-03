import { useAppBridge } from "@shopify/app-bridge-react";

export default function Index() {
  const shopify = useAppBridge();

  return (
    <s-page heading="Welcome to PeakSEO">
      <s-section>
        <s-paragraph>
          🚀 <strong>PeakSEO</strong> is a Shopify app designed to help store owners:
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>
            ✅ Analyze website SEO performance with Google Pagespeed/Lighthouse.
          </s-list-item>
          <s-list-item>
            ✅ Capture screenshots of pages for easy SEO record keeping.
          </s-list-item>
          <s-list-item>
            ✅ Compress product images to save bandwidth and speed up the store.
          </s-list-item>
          <s-list-item>
            ✅ Automatically add watermarks to product images for branding or copyright.
          </s-list-item>
        </s-unordered-list>
        {/* <s-paragraph>
          This app helps you maintain a professional store, improve SEO scores, and manage product images efficiently — all from one dashboard.
        </s-paragraph>
        <s-paragraph>
          Learn more about the technologies used:
        </s-paragraph> */}
        {/* <s-unordered-list>
          <s-list-item>
            🔹 <s-link href="https://reactrouter.com/" target="_blank">React Router</s-link> for app navigation.
          </s-list-item>
          <s-list-item>
            🔹 <s-link href="https://shopify.dev/docs/api/admin-graphql" target="_blank">Shopify Admin GraphQL</s-link> for product management.
          </s-list-item>
          <s-list-item>
            🔹 <s-link href="https://www.prisma.io/" target="_blank">Prisma</s-link> for database management.
          </s-list-item>
        </s-unordered-list> */}
        <s-paragraph>
          Start by connecting your Shopify store and begin optimizing your products and website SEO today!
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
