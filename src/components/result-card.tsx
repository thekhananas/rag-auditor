import { RankBadge } from './rank-badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';

export function ResultCard({
  rank,
  docIndex,
  score,
  delta,
  docText,
  isRerank = false,
}: {
  rank: number;
  docIndex: number;
  score: number;
  delta: number | null;
  docText: string;
  isRerank?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <span className="font-mono text-sm text-muted-foreground">#{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium">
          Chunk {docIndex}
          {isRerank && delta !== null && <RankBadge delta={delta} />}
        </p>
        <p className="text-xs text-muted-foreground truncate">{docText}</p>
        <div className="mt-1 flex items-center gap-2">
          <Progress value={score * 100} className="h-2 flex-1" />
          <span className="text-xs font-mono">{score.toFixed(3)}</span>
        </div>
      </div>
    </motion.div>
  );
}