import { Hono } from "hono";
import { meta, tags } from "../lib/firestore";
import { AppEnv } from "../auth";

export const tagRoutes = new Hono<AppEnv>();

type TagDoc = {
  tag: string;
  category: string;
  subgroup: string;
  count: number;
};

// GET /tags
// Returns the tag vocabulary plus a category → subgroup → tags grouping
// derived from meta/tag-taxonomy when present.
//
// Response shape:
//   {
//     tags: TagDoc[],          // flat list, sorted by count desc
//     groups: {                // hierarchical for grouped autocomplete
//       [category]: {
//         [subgroup]: TagDoc[]
//       }
//     }
//   }
tagRoutes.get("/tags", async (c) => {
  // Pull the per-tag docs (one round trip).
  const snap = await tags().get();
  const flat: TagDoc[] = snap.docs.map((d) => {
    const data = d.data() as Partial<TagDoc>;
    return {
      tag: data.tag ?? d.id,
      category: data.category ?? "uncategorized",
      subgroup: data.subgroup ?? "uncategorized",
      count: typeof data.count === "number" ? data.count : 0,
    };
  });
  flat.sort((a, b) => b.count - a.count);

  const groups: Record<string, Record<string, TagDoc[]>> = {};
  for (const t of flat) {
    if (!groups[t.category]) groups[t.category] = {};
    if (!groups[t.category][t.subgroup]) groups[t.category][t.subgroup] = [];
    groups[t.category][t.subgroup].push(t);
  }

  return c.json({ tags: flat, groups });
});

// GET /tags/taxonomy — raw locked-in taxonomy (rarely needed by clients,
// useful for admin UIs or debug)
tagRoutes.get("/tags/taxonomy", async (c) => {
  const doc = await meta().doc("tag-taxonomy").get();
  if (!doc.exists) return c.json({ taxonomy: null });
  return c.json(doc.data());
});
