const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

import { NextRequest, NextResponse } from 'next/server';
import { CohereClient } from 'cohere-ai';
import { BENCHMARK_CORPUS, BENCHMARK_QUERIES } from '@/data/benchmark';
import { cosineSimilarity } from '@/lib/math';
import { mrrAtK, ndcgAtK } from '@/lib/metrics';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    const cohereKey = apiKey || process.env.COHERE_API_KEY;
    if (!cohereKey) {
      return NextResponse.json({ error: 'Missing Cohere API key' }, { status: 400 });
    }
    const cohere = new CohereClient({ token: cohereKey });

    const results = [];
    let totalEmbedLatency = 0;
    let totalRerankLatency = 0;

    for (const q of BENCHMARK_QUERIES) {
      const t0 = Date.now();

      // Embed documents (small corpus, fine to re-embed each query)
      const docEmbeds = await cohere.embed({
        texts: BENCHMARK_CORPUS,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      });
      const queryEmbed = await cohere.embed({
        texts: [q.query],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
      });

      const embedLatency = Date.now() - t0;

      const getFloats = (emb: any): number[][] => {
        if ('float' in emb) return emb.float!;
        return emb;
      };
      const queryVec = getFloats(queryEmbed.embeddings)[0];
      const docVecs = getFloats(docEmbeds.embeddings);

      const naiveRanking = docVecs
        .map((vec: number[], idx: number) => ({
          index: idx,
          score: cosineSimilarity(queryVec, vec),
        }))
        .sort((a: any, b: any) => b.score - a.score);

      const rerankStart = Date.now();
      const rerank = await cohere.rerank({
        query: q.query,
        documents: BENCHMARK_CORPUS.map((text: string) => ({ text })),
        model: 'rerank-v3.5',
        topN: BENCHMARK_CORPUS.length,
      });
      const rerankLatency = Date.now() - rerankStart;

      const reranked = rerank.results.map((r: any) => ({
        index: r.index,
        score: r.relevanceScore,
      }));

      const naiveMRR = mrrAtK(naiveRanking, q.relevantDocs, 5);
      const rerankMRR = mrrAtK(reranked, q.relevantDocs, 5);
      const naiveNDCG = ndcgAtK(naiveRanking, q.relevantDocs, 5);
      const rerankNDCG = ndcgAtK(reranked, q.relevantDocs, 5);

      results.push({
        queryId: q.id,
        query: q.query,
        naive: { mrr5: naiveMRR, ndcg5: naiveNDCG },
        rerank: { mrr5: rerankMRR, ndcg5: rerankNDCG },
      });

      

      totalEmbedLatency += embedLatency;
      totalRerankLatency += rerankLatency;

      await sleep(6000);
    }

    const avgEmbedLatency = totalEmbedLatency / BENCHMARK_QUERIES.length;
    const avgRerankLatency = totalRerankLatency / BENCHMARK_QUERIES.length;
    const avgTotalLatency = (totalEmbedLatency + totalRerankLatency) / BENCHMARK_QUERIES.length;

    const avgNaiveMRR = results.reduce((sum, r) => sum + r.naive.mrr5, 0) / results.length;
    const avgRerankMRR = results.reduce((sum, r) => sum + r.rerank.mrr5, 0) / results.length;
    const avgNaiveNDCG = results.reduce((sum, r) => sum + r.naive.ndcg5, 0) / results.length;
    const avgRerankNDCG = results.reduce((sum, r) => sum + r.rerank.ndcg5, 0) / results.length;

    return NextResponse.json({
      perQuery: results,
      aggregate: {
        naive: { mrr5: avgNaiveMRR, ndcg5: avgNaiveNDCG },
        rerank: { mrr5: avgRerankMRR, ndcg5: avgRerankNDCG },
      },
      latency: {
        embedAvgMs: avgEmbedLatency,
        rerankAvgMs: avgRerankLatency,
        totalAvgMs: avgTotalLatency,
      },
    });
  } catch (err: any) {
    // Always return a JSON error, never let Next.js render an HTML error page
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}