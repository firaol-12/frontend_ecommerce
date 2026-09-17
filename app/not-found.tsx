import ErrorState from "./components/error-state";

export const metadata = {
  title: "404 — Page not found | MyShop",
};

export default function NotFound() {
  return (
    <ErrorState
      code="404 — Page not found"
      title="This page wandered off"
      description="The page you're looking for doesn't exist, was moved, or the link is broken. Let's get you back to shopping."
      primaryAction={{ label: "Back to home", href: "/" }}
      secondaryAction={{ label: "Browse products", href: "/products" }}
    />
  );
}
