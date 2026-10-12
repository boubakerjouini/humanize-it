// The page sets its own openGraph without images, which drops the root share
// card. An image file beside the page is applied after the page's metadata,
// so this puts the home card (app/opengraph-image.tsx) back on link previews.
export { default, alt, size, contentType } from "@/app/opengraph-image";
