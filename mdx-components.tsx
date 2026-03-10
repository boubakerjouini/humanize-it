import type { MDXComponents } from "mdx/types";
import { Callout } from "@/components/blog/callout";
import { DetectorWidget } from "@/components/blog/detector-widget";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Callout,
    DetectorWidget,
    ...components,
  };
}
