import { useEffect, useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { codein } from "../lib/codein";
import { generateInsights } from "../lib/groq";

export function AIBusinessInsights() {
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsights() {
      const context = await codein.buildContext();
      if (!context || context === "No business records available.") {
        setInsights(["No sufficient data to generate insights yet."]);
      } else {
        const generated = await generateInsights(context);
        setInsights(generated);
      }
      setLoading(false);
    }
    fetchInsights();
  }, []);

  return (
    <div className="bg-card border rounded-2xl shadow-md overflow-hidden flex flex-col h-full">
      <div className="bg-emerald-50 px-6 py-4 border-b flex items-center space-x-2">
        <Brain className="w-5 h-5 text-emerald-600" />
        <span className="font-bold text-sm text-emerald-800 uppercase tracking-wider">
          AI Business Insights
        </span>
      </div>
      <div className="p-6 flex-1 flex flex-col justify-center space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-emerald-100 rounded w-3/4"></div>
            <div className="h-4 bg-emerald-100 rounded w-5/6"></div>
            <div className="h-4 bg-emerald-100 rounded w-2/3"></div>
          </div>
        ) : (
          <ul className="space-y-4">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-slate-700 leading-snug">{insight.replace(/^[-*]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
