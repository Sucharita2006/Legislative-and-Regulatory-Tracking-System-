"use client";

import { useEffect, useState } from "react";

export function TagFilter({
  userEmail,
  value,
  onChange,
  refreshSignal,
  onLoaded,
  onTagsLoaded,
}: {
  userEmail: string;
  value: string;
  onChange: (tag: string) => void;
  refreshSignal?: number;
  onLoaded?: () => void;
  onTagsLoaded?: (tags: string[]) => void;
}) {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/user?path=${encodeURIComponent(`/users/${userEmail}/tags`)}`)
      .then(r => r.json())
      .then(data => {
        const t = data.tags || [];
        setTags(t);
        onTagsLoaded?.(t);
      })
      .catch(() => { /* filter just stays empty if this fails */ })
      .finally(() => onLoaded?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, refreshSignal]);

  // This component no longer renders its own UI — the tags are passed
  // up via onTagsLoaded and rendered inside SearchFilters.
  // Keep the component for its data-fetching role.
  return null;
}
