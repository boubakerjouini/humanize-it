// Word-level diff algorithm using Longest Common Subsequence (LCS)

export type DiffSegment = {
  type: "same" | "added" | "removed";
  text: string;
};

function tokenize(text: string): string[] {
  // Split into words while preserving whitespace as separate tokens
  return text.split(/(\s+)/).filter(t => t.length > 0);
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

export function computeWordDiff(original: string, modified: string): DiffSegment[] {
  const a = tokenize(original);
  const b = tokenize(modified);
  const dp = lcs(a, b);

  const segments: DiffSegment[] = [];
  let i = a.length;
  let j = b.length;

  // Backtrack through LCS table
  const raw: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ type: "same", text: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "added", text: b[j - 1] });
      j--;
    } else {
      raw.push({ type: "removed", text: a[i - 1] });
      i--;
    }
  }

  raw.reverse();

  // Merge consecutive segments of the same type
  for (const seg of raw) {
    const last = segments[segments.length - 1];
    if (last && last.type === seg.type) {
      last.text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}
