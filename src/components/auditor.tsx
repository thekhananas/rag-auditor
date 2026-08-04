'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import {
  ArrowUp,
  ArrowDown,
  Minus,
  FileUp,
  Loader2,
  Zap,
  Settings,
} from 'lucide-react';
import { PRESET_CORPUS } from '@/data/presets';
import { ResultCard } from './result-card';

type ChunkResult = { index: number; score: number };
type AuditData = {
  naiveResults: ChunkResult[];
  rerankResults: ChunkResult[];
  rankMovement: {
    index: number;
    oldRank: number | null;
    newRank: number;
    delta: number | null;
  }[];
  metrics: {
    embedLatencyMs: number;
    rerankLatencyMs: number;
    totalLatencyMs: number;
    top1ReciprocalRankDelta: string;
  };
};

export default function Auditor() {
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditData | null>(null);
  const [error, setError] = useState('');
  const [benchResult, setBenchResult] = useState<any>(null);
  const [benchLoading, setBenchLoading] = useState(false);

  // Load key from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem('cohere_key');
    if (stored) setApiKey(stored);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    sessionStorage.setItem('cohere_key', key);
  };

  const handleRunAudit = useCallback(async () => {
    if (!query.trim() || documents.length === 0) {
      setError('Please enter a query and at least one document chunk.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, documents, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, documents, apiKey]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          setDocuments(Array.isArray(parsed) ? parsed : []);
        } catch {
          setError('Invalid JSON file.');
        }
      } else {
        setDocuments(text.split('\n\n').filter(Boolean));
      }
    };
    reader.readAsText(file);
  };

  const loadPreset = () => setDocuments(PRESET_CORPUS);

  const runBenchmark = async () => {
    setBenchLoading(true);
    setError('');
    setBenchResult(null); // clear previous results
    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey || undefined }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Unexpected response: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benchmark failed');
      setBenchResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBenchLoading(false);
    }
  };

  // ... render UI
  return (
    <main className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Visual RAG &amp; Rerank Auditor
        </h1>
        <p className="text-muted-foreground mt-1">
          Benchmark naive vector search vs Cohere Rerank v3
        </p>
      </header>

      {/* Query Input */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter your query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowKeyInput(!showKeyInput)}
              title="API Key Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          {showKeyInput && (
            <Input
              type="password"
              placeholder="Paste your Cohere API key (stored in browser)"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
            />
          )}

          <div className="flex gap-2 flex-wrap">
            <span className="text-sm font-medium">Quick presets:</span>
            {['Find rate limit retry logic', 'How to handle authentication?', 'Webhook verification'].map(
              (q) => (
                <Badge
                  key={q}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setQuery(q)}
                >
                  {q}
                </Badge>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Corpus Editor */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Document Corpus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadPreset}>
              Load Preset Dataset
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm">
                <FileUp className="h-4 w-4" /> Upload .txt / .json
              </span>
              <input
                type="file"
                accept=".txt,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-xs text-muted-foreground self-center">
              or paste below, chunks separated by double newline
            </span>
          </div>
          <Textarea
            placeholder={`Chunk 1...\n\nChunk 2...`}
            value={documents.join('\n\n')}
            onChange={(e) =>
              setDocuments(e.target.value.split('\n\n').filter(Boolean))
            }
            className="min-h-[200px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {documents.length} chunk{documents.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 mb-4">
        <Button onClick={handleRunAudit} disabled={loading || benchLoading} size="lg">
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Audit...</>
          ) : (
            <><Zap className="mr-2 h-4 w-4" /> Run Audit</>
          )}
        </Button>
        <Button onClick={runBenchmark} disabled={loading || benchLoading} variant="secondary" size="lg">
          {benchLoading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Benchmark (∼60s)...</>
          ) : (
            'Run Benchmark (MRR/NDCG)'
          )}
        </Button>
      </div>

      {/* Delay notice – only visible while benchmark is running */}
      {benchLoading && (
        <p className="text-center text-sm text-muted-foreground mb-4">
          Running 10 queries on the MS‑MARCO subset. This may take ~60 seconds due to trial key rate limits.
        </p>
      )}

      {/* Error display */}
      {error && <p className="text-destructive text-center mb-4">{error}</p>}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Naive Column */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Naive Vector Search (Cosine Similarity)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-2">
                      {result.naiveResults.map((r) => (
                        <ResultCard
                          key={r.index}
                          rank={result.naiveResults.indexOf(r) + 1}
                          docIndex={r.index}
                          score={r.score}
                          delta={null}
                          docText={documents[r.index]?.slice(0, 80) + '...'}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Rerank Column */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Cohere Rerank v3 (Cross-Encoder)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-2">
                      {result.rerankResults.map((r) => {
                        const move = result.rankMovement.find(
                          (m) => m.index === r.index
                        );
                        return (
                          <ResultCard
                            key={r.index}
                            rank={result.rerankResults.indexOf(r) + 1}
                            docIndex={r.index}
                            score={r.score}
                            delta={move?.delta ?? null}
                            docText={documents[r.index]?.slice(0, 80) + '...'}
                            isRerank
                          />
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Metrics Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Latency & Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{result.metrics.top1ReciprocalRankDelta}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-32">Embed Latency</span>
                    <Progress
                      value={
                        (result.metrics.embedLatencyMs /
                          result.metrics.totalLatencyMs) *
                        100
                      }
                      className="flex-1"
                    />
                    <span className="w-16 text-right font-mono">
                      {result.metrics.embedLatencyMs}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-32">Rerank Latency</span>
                    <Progress
                      value={
                        (result.metrics.rerankLatencyMs /
                          result.metrics.totalLatencyMs) *
                        100
                      }
                      className="flex-1"
                    />
                    <span className="w-16 text-right font-mono">
                      {result.metrics.rerankLatencyMs}ms
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="w-32">Total</span>
                    <Progress value={100} className="flex-1" />
                    <span className="w-16 text-right font-mono">
                      {result.metrics.totalLatencyMs}ms
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Benchmark Results */}
      {benchResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="space-y-6"
        >
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Benchmark Results (10 queries)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium">Naive Dense</h4>
                  <p>MRR@5: {benchResult.aggregate.naive.mrr5.toFixed(3)}</p>
                  <p>NDCG@5: {benchResult.aggregate.naive.ndcg5.toFixed(3)}</p>
                </div>
                <div>
                  <h4 className="font-medium">Cohere Rerank</h4>
                  <p>MRR@5: {benchResult.aggregate.rerank.mrr5.toFixed(3)}</p>
                  <p>NDCG@5: {benchResult.aggregate.rerank.ndcg5.toFixed(3)}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div>
                <p className="font-medium">Average Latency</p>
                <p>Embed: {benchResult.latency.embedAvgMs.toFixed(0)}ms | Rerank: {benchResult.latency.rerankAvgMs.toFixed(0)}ms | Total: {benchResult.latency.totalAvgMs.toFixed(0)}ms</p>
              </div>
              {benchResult.aggregate.naive.mrr5 === 1 && benchResult.aggregate.rerank.mrr5 === 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  This dataset is a verbatim match subset. To see rerank’s impact, load a harder, paraphrased benchmark.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </main>
  );
}