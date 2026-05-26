export type NoteStatus = "active" | "archived" | "trash";

export interface NoteIndex {
  id: string;
  title: string;
  path: string;
  relativePath: string;
  folder: string;
  tags: string[];
  collection: string | null;
  status: NoteStatus;
  pinned: boolean;
  created: string; // ISO8601
  modified: string;
  wordCount: number;
  excerpt: string;
  backlinks: string[];
}

export interface NoteFrontMatter {
  id?: string;
  title?: string;
  created?: string;
  modified?: string;
  tags: string[];
  pinned: boolean;
  collection: string | null;
  status: NoteStatus;
  cover: string | null;
  aliases: string[];
}

export interface NoteContent {
  raw: string;
  frontMatter: NoteFrontMatter;
  body: string;
  index: NoteIndex;
}
