/**
 * Mean Reciprocal Rank @ K.
 * Reciprocal rank = 1 / rank_of_first_relevant_doc (or 0 if none in top K)
 */
export function mrrAtK(
  results: { index: number }[], // ranked list of {index}
  relevantIndices: number[],
  k: number = 5
): number {
  const topK = results.slice(0, k);
  const firstRelevantRank = topK.findIndex((r) =>
    relevantIndices.includes(r.index)
  );
  return firstRelevantRank === -1 ? 0 : 1 / (firstRelevantRank + 1);
}

/**
 * Normalized Discounted Cumulative Gain @ K.
 * Uses binary relevance (1 if in relevantIndices, else 0).
 * DCG = sum(rel_i / log2(i+2)) for i=0..K-1, IDCG is DCG of ideal ranking.
 */
export function ndcgAtK(
  results: { index: number }[],
  relevantIndices: number[],
  k: number = 5
): number {
  const topK = results.slice(0, k);
  const rels = topK.map((r) => (relevantIndices.includes(r.index) ? 1 : 0));

  // DCG (discounted cumulative gain) with explicit type parameter to avoid narrowing
  const dcg = rels.reduce<number>(
    (sum, rel, i) => sum + rel / Math.log2(i + 2),
    0
  );

  // Ideal DCG (ideal discounted cumulative gain): sort rels descending (all 1s first, then 0s)
  const idealRels = [...rels].sort((a, b) => b - a);
  const idcg = idealRels.reduce<number>(
    (sum, rel, i) => sum + rel / Math.log2(i + 2),
    0
  );

  return idcg === 0 ? 0 : dcg / idcg;
}