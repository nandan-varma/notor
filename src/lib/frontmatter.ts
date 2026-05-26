import matter from "gray-matter";
import type { NoteFrontMatter } from "@/types/note";

const DEFAULT_FRONT_MATTER: NoteFrontMatter = {
  tags: [],
  pinned: false,
  collection: null,
  status: "active",
  cover: null,
  aliases: [],
};

export function parseFrontMatter(raw: string): {
  data: NoteFrontMatter;
  body: string;
} {
  try {
    const parsed = matter(raw);
    const data = parsed.data as Partial<NoteFrontMatter>;
    return {
      data: {
        ...DEFAULT_FRONT_MATTER,
        ...data,
        tags: Array.isArray(data.tags) ? data.tags : [],
        aliases: Array.isArray(data.aliases) ? data.aliases : [],
      },
      body: parsed.content,
    };
  } catch {
    return { data: { ...DEFAULT_FRONT_MATTER }, body: raw };
  }
}
