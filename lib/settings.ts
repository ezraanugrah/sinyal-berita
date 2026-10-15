import type { Settings, Topic } from "./types";

export const DEFAULT_TOPICS: Topic[] = [
  { id: "indonesia", label: "Indonesia", query: "berita terbaru Indonesia", enabled: true, weight: 3 },
  { id: "dunia", label: "Dunia", query: "world news international", enabled: true, weight: 3 },
  { id: "bisnis", label: "Bisnis & Ekonomi", query: "bisnis ekonomi Indonesia", enabled: true, weight: 4 },
  { id: "teknologi", label: "Teknologi", query: "teknologi digital inovasi", enabled: true, weight: 4 },
  { id: "ai", label: "AI", query: "artificial intelligence AI news", enabled: true, weight: 5 },
  { id: "kesehatan", label: "Kesehatan", query: "kesehatan riset medis", enabled: true, weight: 3 },
];

export const DEFAULT_SETTINGS: Settings = {
  topics: DEFAULT_TOPICS,
  layout: "grid",
  sort: "relevant",
  theme: "dark",
  columns: 2,
};

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_SETTINGS);
  const obj = value as Partial<Settings>;
  const rawTopics = Array.isArray(obj.topics) ? obj.topics : DEFAULT_TOPICS;
  const topics: Topic[] = rawTopics.slice(0, 12).flatMap((t) => {
    if (!t || typeof t !== "object" || typeof t.id !== "string" || typeof t.label !== "string" || typeof t.query !== "string") return [];
    const label = t.label.trim().slice(0, 40);
    const query = t.query.trim().slice(0, 120);
    if (!label || !query) return [];
    return [{
      id: t.id.slice(0, 64), label, query,
      enabled: Boolean(t.enabled),
      weight: Math.max(0, Math.min(5, Number(t.weight) || 0)),
    }];
  });
  return {
    topics: topics.length ? topics : structuredClone(DEFAULT_TOPICS),
    layout: obj.layout === "list" ? "list" : "grid",
    sort: obj.sort === "recent" ? "recent" : "relevant",
    theme: obj.theme === "light" ? "light" : "dark",
    columns: obj.columns === 3 ? 3 : 2,
  };
}
