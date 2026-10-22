# Supabase traffic reduction

New admin image uploads are resized and compressed before reaching Storage:

| Use | Maximum longest side | Maximum file size |
| --- | --- | --- |
| Product | 960 px | 200 KiB |
| Banner | 1920 px | 400 KiB |
| Logo | 640 px | 150 KiB |

Smaller images are kept intact. GIF animation and SVG logos are preserved but must
fit the size budget. Transparent raster images retain alpha when encoded as WebP.
Oversized or undecodable uploads are rejected with an error rather than uploaded
unmodified. Files receive unique URLs and a one-year browser cache lifetime;
replacing an image creates a new URL so visitors can receive the new image.

The closed admin dashboard no longer fetches orders or promo codes, or subscribes
to their realtime updates, on every storefront visit. Opening the dashboard starts
its fetches and subscription; closing it removes that subscription. This reduces
uncached/API traffic, separately from the Storage cached-egress quota. It does not
replace database access controls.

## Existing images and release

These changes affect future uploads only. Existing images retain their original
size and cache headers. After Storage access is restored, identify the most
requested objects from API Gateway/Storage logs, then re-upload the active large
images using the updated admin uploader and save their new URLs. Keep old objects
until references have been checked; this change does not delete any objects.

The storefront currently shows the bundled Unsplash fallback when Supabase
requests fail. Inspect the actual database-backed images after access is restored;
the fallback images do not identify the historical traffic source.

Deploy the updated Vite app through the site's existing deployment workflow.
Monitor the organization Usage page after publishing (usage can lag). Compare the
daily cached and uncached transfer against the remaining monthly quota. These
optimizations lower traffic, but cannot guarantee that a fixed free quota will
never be exceeded as visitor numbers grow. For higher traffic, size a paid plan or
move public media to a separately provisioned hosting/CDN service.

Browser caching reduces repeat transfers from the same device. Supabase CDN cache
hits still count as cached egress. Nothing here resets usage already incurred or
lifts an existing quota restriction.

References:
- https://supabase.com/docs/guides/platform/manage-your-usage/egress
- https://supabase.com/docs/guides/storage/serving/bandwidth
