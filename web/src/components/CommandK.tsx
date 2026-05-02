import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CalendarIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kicker } from "@/components/ui/kicker";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import type { Conference, PublicUser, TagsResponse } from "../api";
import {
  getTagsCache,
  loadTags,
  useGlobalSearch,
} from "../hooks/useGlobalSearch";
import { UserAvatar } from "./UserAvatar";
import { VennEgg } from "./VennEgg";

const VENN_EGG_WINDOW_MS = 1500;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickConference: (conf: Conference) => void;
  onPickUser: (user: PublicUser) => void;
};

export function CommandK({
  open,
  onOpenChange,
  onPickConference,
  onPickUser,
}: Props) {
  const [q, setQ] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [tagsData, setTagsData] = useState<TagsResponse | null>(getTagsCache());
  const [vennOpen, setVennOpen] = useState(false);
  const escStreak = useRef<{ count: number; last: number }>({
    count: 0,
    last: 0,
  });
  const location = useLocation();
  const onRoot = location.pathname === "/";

  const { conferences, people, loading } = useGlobalSearch(q, selectedTags);

  // Cmd/Ctrl+K toggles the palette. Esc count → 3 with ≥2 tags fires the
  // VennEgg easter egg.
  const selectedTagsRef = useRef(selectedTags);
  selectedTagsRef.current = selectedTags;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(true);
        return;
      }
      if (e.key !== "Escape") {
        escStreak.current = { count: 0, last: 0 };
        return;
      }
      const now = Date.now();
      if (now - escStreak.current.last > VENN_EGG_WINDOW_MS) {
        escStreak.current = { count: 1, last: now };
      } else {
        escStreak.current = {
          count: escStreak.current.count + 1,
          last: now,
        };
      }
      if (
        escStreak.current.count >= 3 &&
        selectedTagsRef.current.length >= 2
      ) {
        escStreak.current = { count: 0, last: 0 };
        setVennOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  // Lazy-load tag catalog when the picker is needed.
  useEffect(() => {
    if (!tagsData && (open || tagPickerOpen)) {
      loadTags()
        .then(setTagsData)
        .catch((err) => console.error("load tags", err));
    }
  }, [open, tagPickerOpen, tagsData]);

  // Close the palette when the route leaves `/` so it doesn't sit on top of
  // sub-pages.
  useEffect(() => {
    if (!onRoot && open) onOpenChange(false);
  }, [onRoot, open, onOpenChange]);

  const filteredGroups = useMemo(() => {
    if (!tagsData) return null;
    const needle = tagQuery.trim().toLowerCase();
    const selected = new Set(selectedTags);
    const out: Array<{
      category: string;
      tags: { tag: string; count: number; subgroup: string }[];
    }> = [];
    for (const [cat, subs] of Object.entries(tagsData.groups)) {
      const flat = Object.entries(subs).flatMap(([sub, ts]) =>
        ts.map((t) => ({ tag: t.tag, count: t.count, subgroup: sub })),
      );
      const filtered = flat
        .filter((t) => !selected.has(t.tag))
        .filter((t) => (needle ? t.tag.includes(needle) : true))
        .sort((a, b) => b.count - a.count);
      if (filtered.length > 0) {
        out.push({
          category: cat,
          tags: needle ? filtered.slice(0, 8) : filtered.slice(0, 6),
        });
      }
    }
    if (needle) out.sort((a, b) => b.tags.length - a.tags.length);
    return out;
  }, [tagsData, tagQuery, selectedTags]);

  function addTag(tag: string) {
    if (selectedTags.includes(tag)) return;
    setSelectedTags([...selectedTags, tag]);
    setTagQuery("");
    setTagPickerOpen(false);
  }

  function removeTag(tag: string) {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  }

  const hasQuery = q.trim().length > 0;
  const hasTags = selectedTags.length > 0;
  const hasResults = conferences.length > 0 || people.length > 0;
  const showEmpty =
    !loading && !hasResults && (hasQuery || hasTags);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[560px] rounded-2xl bg-paper border border-hair p-0 gap-0 shadow-[var(--shadow-modal)]"
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">
            Search conferences, people, and places.
          </DialogDescription>

          {/* Search input row */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-hair">
            <SearchIcon
              className="size-4 text-ink2 shrink-0"
              aria-hidden
            />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Backspace" &&
                  q.length === 0 &&
                  selectedTags.length > 0
                ) {
                  removeTag(selectedTags[selectedTags.length - 1]);
                }
              }}
              placeholder="Search conferences, people, places…"
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-ui text-[15px] text-ink placeholder:text-ink3"
              aria-label="Search"
            />
            <button
              type="button"
              onClick={() => setTagPickerOpen((v) => !v)}
              aria-label="Filter by tag"
              aria-pressed={tagPickerOpen}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[12px] font-medium shrink-0 transition-colors",
                tagPickerOpen
                  ? "border-ink bg-ink text-bg"
                  : "border-hair text-ink hover:border-ink",
              )}
            >
              # Tags
            </button>
            <kbd className="font-mono text-[11px] text-ink2 px-1.5 py-0.5 rounded border border-hair bg-hair-soft">
              esc
            </kbd>
          </div>

          {/* Selected tag chips */}
          {selectedTags.length > 0 ? (
            <div className="flex items-center flex-wrap gap-1.5 px-5 py-2 border-b border-hair">
              {selectedTags.map((tag) => (
                <button
                  key={`chip:${tag}`}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-hair bg-hair-soft text-ink text-[11px]"
                  title="Remove tag"
                >
                  {tag}
                  <XIcon className="size-3 opacity-70" aria-hidden />
                </button>
              ))}
            </div>
          ) : null}

          {/* Tag picker (above results when open) */}
          {tagPickerOpen ? (
            <div className="px-5 py-3 border-b border-hair max-h-[280px] overflow-auto">
              <input
                placeholder="Search tags…"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setTagPickerOpen(false);
                  } else if (
                    e.key === "Enter" &&
                    filteredGroups &&
                    filteredGroups.length > 0
                  ) {
                    const top = filteredGroups[0]?.tags[0]?.tag;
                    if (top) addTag(top);
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-md border border-hair bg-transparent font-ui text-[12px] text-ink outline-none mb-2"
              />
              <div className="flex flex-col gap-2">
                {filteredGroups === null ? (
                  <div className="px-2 py-1 text-[12px] text-ink2">
                    Loading tags…
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="px-2 py-1 text-[12px] text-ink2">
                    No matching tags
                  </div>
                ) : (
                  filteredGroups.map((g) => (
                    <div key={g.category} className="flex flex-col gap-1">
                      <Kicker>{g.category}</Kicker>
                      <div className="flex flex-wrap gap-1">
                        {g.tags.map((t) => (
                          <button
                            key={t.tag}
                            type="button"
                            onClick={() => addTag(t.tag)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-hair bg-transparent text-ink text-[11px] hover:bg-hair-soft"
                          >
                            {t.tag}
                            <span className="opacity-55 text-[10px]">
                              {t.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {/* Results region */}
          <div className="max-h-[400px] overflow-auto py-2">
            {loading ? (
              <div className="px-5 py-3 text-[13px] text-ink2">Searching…</div>
            ) : null}

            {conferences.length > 0 ? (
              <div className="py-2">
                <Kicker className="px-5 pb-1">Conferences</Kicker>
                <ul>
                  {conferences.map((c) => (
                    <li key={`c:${c.id}`}>
                      <button
                        type="button"
                        onClick={() => onPickConference(c)}
                        className={`w-full flex items-center gap-3 px-5 py-2 text-left ${
                          c.premium
                            ? "bg-brand-soft hover:bg-brand-soft/80"
                            : "hover:bg-hair-soft"
                        }`}
                      >
                        {c.premium && c.premiumImage ? (
                          <img
                            src={c.premiumImage}
                            alt=""
                            aria-hidden
                            className="w-5 h-5 shrink-0 rounded object-contain bg-brand-soft p-px"
                          />
                        ) : c.premium ? (
                          <span
                            aria-hidden
                            className="size-4 shrink-0 text-brand text-center leading-none"
                          >
                            ★
                          </span>
                        ) : (
                          <CalendarIcon
                            className="size-4 text-ink2 shrink-0"
                            aria-hidden
                          />
                        )}
                        <span className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                          <span className="font-display text-[15px] font-medium text-ink truncate max-w-full">
                            {c.name}
                            {c.premium ? (
                              <span className="ml-2 align-middle inline-block">
                                <Tag accent>Premium</Tag>
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-ink2 truncate max-w-full">
                            {c.locationName} ·{" "}
                            {new Date(c.startDate).toLocaleDateString()}
                          </span>
                        </span>
                        <ChevronRightIcon
                          className="size-4 text-ink3 shrink-0"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {people.length > 0 ? (
              <div className="py-2">
                <Kicker className="px-5 pb-1">People</Kicker>
                <ul>
                  {people.map((u) => (
                    <li key={`u:${u.id}`}>
                      <button
                        type="button"
                        onClick={() => onPickUser(u)}
                        className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-hair-soft"
                      >
                        <UserAvatar
                          avatarId={u.avatarId}
                          photoURL={u.photoURL}
                          displayName={u.displayName}
                          size="xs"
                        />
                        <span className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                          <span className="font-display text-[15px] font-medium text-ink truncate max-w-full">
                            {u.displayName ?? "Unnamed"}
                          </span>
                          <span className="text-[11px] text-ink2 truncate max-w-full">
                            person
                          </span>
                        </span>
                        <ChevronRightIcon
                          className="size-4 text-ink3 shrink-0"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showEmpty ? (
              <div className="px-5 py-3 text-[13px] text-ink2">No matches</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {vennOpen && selectedTags.length >= 2 ? (
        <VennEgg tags={selectedTags} onClose={() => setVennOpen(false)} />
      ) : null}
    </>
  );
}
