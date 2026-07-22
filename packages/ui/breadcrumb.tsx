import * as React from "react";
import { YStack, Text, XStack } from "tamagui";

const Breadcrumb = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<"nav">>(
  ({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />
);
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = React.forwardRef<HTMLOListElement, React.ComponentPropsWithoutRef<"ol">>(
  ({ ...props }, ref) => (
    <ol ref={ref} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }} {...props} />
  )
);
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<"li">>(
  ({ ...props }, ref) => (
    <li ref={ref} style={{ display: "flex", alignItems: "center", gap: 8 }} {...props} />
  )
);
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, React.ComponentPropsWithoutRef<"a">>(
  ({ ...props }, ref) => <a ref={ref} style={{ color: "inherit", textDecoration: "none" }} {...props} />
);
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = React.forwardRef<HTMLSpanElement, React.ComponentPropsWithoutRef<"span">>(
  ({ ...props }, ref) => (
    <span ref={ref} role="link" aria-disabled="true" aria-current="page" {...props} />
  )
);
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({ children, ...props }: React.ComponentProps<"li">) => (
  <li role="presentation" aria-hidden="true" {...props}>
    {children || <Text fontSize={12} color="$gray9">/</Text>}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
};

