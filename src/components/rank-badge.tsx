import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function RankBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <Badge variant="secondary">NEW</Badge>;
  if (delta > 0)
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        <ArrowUp className="w-3 h-3 mr-1" />+{delta}
      </Badge>
    );
  if (delta < 0)
    return (
      <Badge variant="destructive">
        <ArrowDown className="w-3 h-3 mr-1" />
        {delta}
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Minus className="w-3 h-3 mr-1" />SAME
    </Badge>
  );
}