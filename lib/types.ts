export type Topic = {
  id: string;
  label: string;
  query: string;
  enabled: boolean;
  weight: number;
};

export type LayoutMode = "grid" | "list";
export type SortMode = "relevant" | "recent";

export type Settings = {
  topics: Topic[];
  layout: LayoutMode;
  sort: SortMode;
  theme: "dark" | "light";
  columns: 2 | 3;
};

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  date: string;
  topic: string;
  description: string;
};

export type Interaction = {
  article_id: string;
  title: string;
  url: string;
  date: string;
  source: string;
  topic: string;
  rating: number | null;
  saved: boolean;
  updated_at: string;
};

export type ScoredArticle = Article & { relevance: number };
