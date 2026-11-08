/**
 * Word-level diff (longest common subsequence) for showing what an author
 * changed between manuscript revisions. Small inputs only (titles,
 * abstracts): capped so the O(n·m) table stays cheap.
 */
export type DiffPart = { type: "same" | "added" | "removed"; text: string };

const MAX_TOKENS = 1500;

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter((t) => t.length).slice(0, MAX_TOKENS);
  const b = after.split(/(\s+)/).filter((t) => t.length).slice(0, MAX_TOKENS);
  const n = a.length;
  const m = b.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < n) push("removed", a[i++]);
  while (j < m) push("added", b[j++]);
  return out;
}
