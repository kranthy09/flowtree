import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title:       "FlowTree",
  description: "Visual API specification builder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
