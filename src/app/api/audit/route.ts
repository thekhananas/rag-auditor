import { NextRequest, NextResponse } from 'next/server';
import { CohereClient } from 'cohere-ai';
import { cosineSimilarity } from '@/lib/math';

export async function POST(req: NextRequest) {
    const { query, documents, apiKey } = await req.json();

    const cohereKey = apiKey || process.env.COHERE_API_KEY;
    if (!cohereKey) {
        return NextResponse.json(
            { error: 'No Cohere API key provided. Add it in settings or as COHERE_API_KEY env.' },
            { status: 400 }
        );
    }

    const cohere = new CohereClient({ token: cohereKey });

    try {
        const t0 = Date.now();

        // -------- here we calculate the Embed + naive cosine search --------
        const embedStart = Date.now();
        const [queryEmbed, docEmbeds] = await Promise.all([
            cohere.embed({
                texts: [query],
                model: 'embed-english-v3.0',
                inputType: 'search_query',
            }),
            cohere.embed({
                texts: documents,
                model: 'embed-english-v3.0',
                inputType: 'search_document',
            }),
        ]);
        const embedLatency = Date.now() - embedStart;

        // const queryVec = queryEmbed.embeddings[0] as number[];
        // const docVecs = docEmbeds.embeddings as number[][];

        const queryEmbeddingObj = queryEmbed.embeddings;
        const queryVec = 'float' in queryEmbeddingObj ? queryEmbeddingObj.float![0] : (queryEmbeddingObj as number[][])[0];

        const docEmbeddingObj = docEmbeds.embeddings;
        const docVecs = 'float' in docEmbeddingObj
            ? docEmbeddingObj.float!
            : (docEmbeddingObj as number[][]);

        const naiveScores = docVecs.map((vec, idx) => ({
            index: idx,
            score: cosineSimilarity(queryVec, vec),
        }));
        naiveScores.sort((a, b) => b.score - a.score);

        // -------- here we calculate the Cohere Rerank --------
        const rerankStart = Date.now();
        const rerank = await cohere.rerank({
            query,
            documents: documents.map((text: string) => ({ text })),
            model: 'rerank-v3.5',
            topN: documents.length,
        });
        const rerankLatency = Date.now() - rerankStart;

        const reranked = rerank.results.map((r) => ({
            index: r.index,
            score: r.relevanceScore,
        }));

        // -------- here compute rank movement --------
        const rankMapNaive = new Map<number, number>();
        naiveScores.forEach((s, rank) => rankMapNaive.set(s.index, rank + 1));

        const rankMovement = reranked.map((r, newRank) => {
            const oldRank = rankMapNaive.get(r.index);
            return {
                index: r.index,
                oldRank: oldRank ?? null,
                newRank: newRank + 1,
                delta: oldRank ? oldRank - (newRank + 1) : null, // positive = jumped up
            };
        });

        // Top-1 change metric
        const top1Naive = naiveScores[0]?.index;
        const top1Rerank = reranked[0]?.index;
        const top1ReciprocalRankDelta =
            top1Naive !== top1Rerank
                ? `Top‑1 changed from doc ${top1Naive} → ${top1Rerank}`
                : 'Top‑1 unchanged';

        const totalLatency = Date.now() - t0;

        return NextResponse.json({
            naiveResults: naiveScores.slice(0, 5).map((s) => ({
                index: s.index,
                score: s.score,
            })),
            rerankResults: reranked.slice(0, 5).map((r) => ({
                index: r.index,
                score: r.score,
            })),
            rankMovement: rankMovement.filter((m) => m.newRank <= 5),
            metrics: {
                embedLatencyMs: embedLatency,
                rerankLatencyMs: rerankLatency,
                totalLatencyMs: totalLatency,
                top1ReciprocalRankDelta,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}