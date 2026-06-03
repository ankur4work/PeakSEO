import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Boost Your Store's SEO with PeakSEO</h1>
        <p className={styles.text}>
          Analyze, optimize, and dominate search rankings — all from one dashboard.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>SEO Analysis</strong>. Instantly audit your store's SEO performance with Google Lighthouse scores.
          </li>
          <li>
            <strong>Image Optimizer</strong>. Compress and watermark product images to speed up your store.
          </li>
          <li>
            <strong>Page Screenshots</strong>. Capture and record page snapshots for SEO tracking and reporting.
          </li>
        </ul>
      </div>
    </div>
  );
}
