import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import type { Article } from "@/lib/types";

export const runtime = "nodejs";

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, processEntities: false });
const stringValue = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object" && "#text" in v) return stringValue((v as Record<string, unknown>)["#text"]);
  return "";
};

type TopicRequest = { id: string; query: string };
async function retrieveFeed(topic: TopicRequest): Promise<Article[]> {
  const query = `${topic.query} when:3d`;
  const endpoint = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const response = await fetch(endpoint, { next: { revalidate: 900 }, signal: AbortSignal.timeout(12000), headers: { "User-Agent": "SinyalBerita/1.0 (+RSS reader)", "Accept": "application/rss+xml, application/xml, text/xml" } });
  if (!response.ok) throw new Error(`Sumber berita gagal (${response.status})`);
  const parsed = parser.parse(await response.text());
  const raw = parsed?.rss?.channel?.item;
  const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.slice(0, 20).flatMap((x): Article[] => {
    if (!x || typeof x !== "object") return [];
    const item = x as Record<string, unknown>;
    const title = stringValue(item.title).trim();
    const url = stringValue(item.link).trim();
    if (!title || !/^https:\/\//i.test(url)) return [];
    const source = stringValue(item.source) || "Google News";
    const pub = stringValue(item.pubDate);
    const parsedDate = Date.parse(pub);
    const date = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : new Date().toISOString();
    const cleanTitle = title.replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
    const id = createHash("sha256").update(url).digest("hex").slice(0, 32);
    return [{ id, title: cleanTitle || title, url, source, date, topic: topic.id, description: "" }];
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.topics)) return NextResponse.json({ error: "Format topik tidak valid" }, { status: 400 });
    const topics: TopicRequest[] = body.topics.slice(0, 12).flatMap((t: unknown) => {
      if (!t || typeof t !== "object") return [];
      const o = t as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.query !== "string") return [];
      const id = o.id.trim().slice(0, 64);
      const query = o.query.trim().slice(0, 120);
      if (!id || query.length < 2) return [];
      return [{ id, query }];
    });
    if (!topics.length) return NextResponse.json({ articles: [], failures: [] });
    const results = await Promise.allSettled(topics.map(retrieveFeed));
    const articles: Article[] = [];
    const failures: string[] = [];
    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      if (result.status === "fulfilled") articles.push(...result.value);
      else failures.push(topics[index].id);
    }
    // Satu tautan bisa muncul di banyak kategori. Tetap tampilkan hanya sekali.
    const seen = new Set<string>();
    const unique = articles.filter((a) => {
      const key = a.title.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return NextResponse.json({ articles: unique.slice(0, 130), failures, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Permintaan berita gagal diproses" }, { status: 400 });
  }
}
