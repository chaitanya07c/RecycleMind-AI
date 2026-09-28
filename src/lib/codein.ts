import { hindsight } from './hindsight';

class CodeIn {
  async buildContext(query?: string): Promise<string> {
    try {
      console.log(query); // Use the query parameter to fix TS6133
      // For hackathon, just pulling recent memories from Hindsight.
      // In a real app, we'd also pull specific Supabase records based on query.
      const memories = await hindsight.getRecentMemories(20);
      
      if (memories.length === 0) {
        return "No business records available.";
      }
      
      const contextLines = memories.map(m => {
        let metaString = '';
        if (m.metadata) {
          metaString = Object.entries(m.metadata).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
        return `[${m.type}] ${m.title} - ${m.content} (${metaString})`;
      });

      // Remove duplicate context (basic implementation)
      const uniqueContext = Array.from(new Set(contextLines));

      return uniqueContext.join('\n');
    } catch (error) {
      console.error("Code.in failed to build context", error);
      return "";
    }
  }
}

export const codein = new CodeIn();
