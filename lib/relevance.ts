import type { Article, Interaction, ScoredArticle, Settings } from "./types";

// Skor transparan & sederhana: bobot topik + preferensi sumber + kata dari judul
// yang pernah dinilai. Bukan AI eksternal dan bukan probabilitas statistik.
const STOP = new Set([
  "yang", "dan", "dari", "untuk", "dengan", "pada", "atau", "dalam", "akan", "jadi", "sebuah", "ketika", "karena", "sudah", "baru", "lebih", "hari", "ini", "itu", "tak", "ada", "apa", "di", "ke", "se", "the", "and", "from", "with", "for", "to", "in", "on", "is", "are", "of", "as", "at", "after", "about", "news", "update", "latest", "how", "why", "by", "a", "an", "its", "has", "have", "will", "get", "your", "their"
]);

export function tokens(title: string): string[] {
  return [...new Set(title.toLocaleLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((s) => s.length >= 4 && s.length <= 24 && !STOP.has(s)))];
}

function smoothedTaste(values: number[], shrink = 3): number {
  // Rata-rata preferensi: -1 (hindari) hingga +1 (suka), ke 0 bila sampel sedikit.
  return values.reduce((n, value) => n + (value - 3) / 2, 0) / (values.length + shrink);
}

export function scoreArticles(articles: Article[], interactionMap: Record<string, Interaction>, settings: Settings): ScoredArticle[] {
  const feedback = Object.values(interactionMap).filter((i) => i.rating != null);
  const topicStats: Record<string, number[]> = {};
  const sourceStats: Record<string, number[]> = {};
  const wordStats: Record<string, number[]> = {};
  for (const row of feedback) {
    const rating = row.rating!;
    (topicStats[row.topic] ??= []).push(rating);
    (sourceStats[row.source.toLowerCase()] ??= []).push(rating);
    for (const word of tokens(row.title)) (wordStats[word] ??= []).push(rating);
  }
  const weights = Object.fromEntries(settings.topics.map((t) => [t.id, t.weight]));
  return articles.map((a) => {
    const now = Date.now();
    const ageHours = Math.max(0, (now - new Date(a.date).getTime()) / 3600000);
    const freshness = Number.isFinite(ageHours) ? Math.max(-6, 7 - ageHours / 12) : 0;
    const topic = smoothedTaste(topicStats[a.topic] ?? []) * 20;
    const source = smoothedTaste(sourceStats[a.source.toLowerCase()] ?? []) * 15;
    const wordValues = tokens(a.title).map((word) => smoothedTaste(wordStats[word] ?? [], 5)).filter((s) => s !== 0);
    const terms = wordValues.length ? (wordValues.reduce((s, n) => s + n, 0) / Math.sqrt(wordValues.length)) * 18 : 0;
    const manual = ((weights[a.topic] ?? 3) - 3) * 5;
    const own = interactionMap[a.id]?.rating;
    const ratedPenalty = own ? -4 : 0;
    const relevance = Math.round(Math.max(1, Math.min(99, 62 + freshness + topic + source + terms + manual + ratedPenalty)));
    return { ...a, relevance };
  });
}
