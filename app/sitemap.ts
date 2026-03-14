import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://humanizeit.app";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/lifetime`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // Blog articles
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/blog/undetectable-ai-alternative`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog/humanize-chatgpt-text`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog/bypass-ai-detection`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog/best-ai-humanizer-tools`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog/ai-detection-how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Compare pages
    { url: `${baseUrl}/compare/humanizeit-vs-undetectable-ai`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/compare/humanizeit-vs-stealthgpt`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },

    // Use cases
    { url: `${baseUrl}/use-cases/students`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/use-cases/copywriters`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/use-cases/agencies`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },

    // Legal
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
