import { authenticate } from "../shopify.server";

const PRODUCTS_QUERY = `
  {
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
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const res = await admin.graphql(PRODUCTS_QUERY);
    const { data } = await res.json();
    return Response.json({ products: data?.products?.edges || [] });
  } catch (err) {
    console.error("fetch-products error:", err.message);
    return Response.json({ products: [], error: err.message });
  }
};
