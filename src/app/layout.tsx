import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PrimeView Realty | Find your place",
    template: "%s | PrimeView Realty",
  },
  description:
    "Find your next home with PrimeView Realty. Thoughtfully selected properties and trusted local guidance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
