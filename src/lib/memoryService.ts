import { hindsight } from './hindsight';

// ============================================================
// Route classifier — determines which pipeline to use
// ============================================================

export type Route = 'memory_save' | 'memory_recall' | 'erp_analysis' | 'general';

/**
 * Classify user intent into one of 4 routes.
 * Uses sentence-level structure, NOT loose keyword matching.
 */
export function classifyRoute(query: string): Route {
  const q = query.toLowerCase().trim();

  // ── Route 2: Memory Save ──────────────────────────────────
  // Only when the user explicitly COMMANDS us to remember.
  // The sentence must START with or CONTAIN a direct imperative.
  const savePatterns = [
    /^remember\b/,
    /^save this\b/,
    /^note this\b/,
    /^note that\b/,
    /^learn this\b/,
    /^learn that\b/,
    /^don'?t forget\b/,
    /\bremember this\b/,
    /\bremember that\b/,
    /\bsave this\b/,
    /\bnote this\b/,
    /\blearn this\b/,
  ];
  if (savePatterns.some(p => p.test(q))) {
    return 'memory_save';
  }

  // ── Route 3: Memory Recall ────────────────────────────────
  const recallPatterns = [
    /^what do you remember/,
    /^what did you remember/,
    /^recall\b/,
    /^show memories/,
    /\bdo you remember\b/,
    /\bwhat do you know about\b/,
    /\bwhat did i tell you about\b/,
  ];
  if (recallPatterns.some(p => p.test(q))) {
    return 'memory_recall';
  }

  // ── Route 4: General conversation (non-ERP) ───────────────
  const generalPatterns = [
    /^(hi|hello|hey|good morning|good evening|thanks|thank you|bye)\b/,
    /^who are you/,
    /^what are you/,
    /^what can you do/,
    /^how are you/,
  ];
  if (generalPatterns.some(p => p.test(q))) {
    return 'general';
  }

  // ── Route 1: Business Analysis (default) ──────────────────
  return 'erp_analysis';
}

/**
 * Detect which ERP modules are relevant based on query keywords.
 * No Groq call needed — fast local detection.
 */
export function detectModules(query: string): string[] {
  const q = query.toLowerCase();
  const modules: string[] = [];

  const purchaseWords = ['purchase', 'supplier', 'shop', 'kingfisher', 'budweiser', 'beer', 'bottle', 'buy', 'bought', 'cheapest', 'rate', 'brand', 'akividu', 'bhimavaram'];
  const salesWords = ['sale', 'sold', 'customer', 'buyer', 'pending', 'payment', 'late', 'fast', 'revenue', 'invoice', 'overdue', 'collect', 'collection'];
  const attendanceWords = ['attendance', 'absent', 'present', 'worker', 'employee', 'overtime', 'shift'];
  const expenseWords = ['expense', 'diesel', 'fuel', 'rent', 'salary', 'cost', 'spend', 'spent'];
  const stockWords = ['stock', 'inventory', 'material', 'low stock', 'running low', 'remaining'];
  const profitWords = ['profit', 'loss', 'revenue', 'compare', 'summary', 'total', 'this month', 'last month', 'this week', 'yesterday', 'today', 'august', 'september', 'october'];

  if (purchaseWords.some(w => q.includes(w))) modules.push('purchases');
  if (salesWords.some(w => q.includes(w))) modules.push('sales');
  if (attendanceWords.some(w => q.includes(w))) modules.push('attendance');
  if (expenseWords.some(w => q.includes(w))) modules.push('expenses');
  if (stockWords.some(w => q.includes(w))) modules.push('stock');

  // Profit & comparison queries need multiple modules
  if (profitWords.some(w => q.includes(w))) {
    if (!modules.includes('purchases')) modules.push('purchases');
    if (!modules.includes('sales')) modules.push('sales');
    if (!modules.includes('expenses')) modules.push('expenses');
  }

  // If nothing matched, load everything (the user asked something unexpected)
  if (modules.length === 0) {
    return ['purchases', 'sales', 'attendance', 'expenses', 'stock'];
  }

  return modules;
}

/**
 * Route 2: Save a memory. Extracts the fact from the user sentence.
 */
export async function saveMemory(query: string): Promise<string> {
  // Strip the command prefix to get the actual fact
  const fact = query
    .replace(/^(remember|save this|note this|note that|learn this|learn that|don'?t forget)\s*[:,.]?\s*/i, '')
    .replace(/\b(remember this|remember that|save this|note this|learn this)\b/i, '')
    .trim();

  if (!fact) {
    return "What would you like me to remember?";
  }

  try {
    await hindsight.retainMemory(fact, 'Learned Business Fact', 'User Fact');
    return `Noted! I've saved: "${fact}"`;
  } catch (error) {
    console.error("Memory save failed:", error);
    return "I couldn't save that memory right now, but I heard you.";
  }
}

/**
 * Route 3: Recall memories matching a subject.
 */
export async function recallMemories(query: string): Promise<string> {
  // Extract the subject the user is asking about
  const subject = query
    .replace(/^(what do you remember about|what did you remember about|recall|show memories about|do you remember|what do you know about|what did i tell you about)\s*/i, '')
    .replace(/\?/g, '')
    .trim();

  try {
    const memories = await hindsight.recallMemory(subject);
    if (memories.length === 0) {
      return `I don't have any saved memories about "${subject}".`;
    }
    const lines = memories.slice(0, 5).map(m => `• ${m.content}`);
    return `Here's what I remember about "${subject}":\n${lines.join('\n')}`;
  } catch (error) {
    console.error("Memory recall failed:", error);
    return "I couldn't retrieve memories right now.";
  }
}

/**
 * Log ERP action as memory (called from ERP pages, not from chat).
 */
export async function logERPMemory(action: string, details: string, type: string) {
  try {
    await hindsight.retainMemory(details, type, action);
  } catch (error) {
    console.error("Failed to log ERP memory:", error);
  }
}
