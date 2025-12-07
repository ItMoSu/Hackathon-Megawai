import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://megawai.id";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/products/", "/input/", "/reports/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
