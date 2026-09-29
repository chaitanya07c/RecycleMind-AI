import { hindsight } from "./hindsight";

// ============================================================
// Route classifier
// ============================================================

export type Route =
  | "memory_save"
  | "memory_recall"
  | "memory_forget"
  | "erp_analysis"
  | "general";

export function classifyRoute(query: string): Route {
  const q = query.toLowerCase().trim();

  // SAVE
  const savePatterns = [
    /^remember\b/,
    /^save this\b/,
    /^note this\b/,
    /^note that\b/,
    /^learn this\b/,
    /^learn that\b/,
    /^don't forget\b/,
    /\bremember this\b/,
    /\bremember that\b/,
  ];

  if (savePatterns.some((p) => p.test(q))) {
    return "memory_save";
  }

  // FORGET
  const forgetPatterns = [
    /^forget\b/,
    /^delete memory\b/,
    /^remove memory\b/,
    /^forget this\b/,
  ];

  if (forgetPatterns.some((p) => p.test(q))) {
    return "memory_forget";
  }

  // RECALL
  const recallPatterns = [
    /^what do you remember/,
    /^what did you remember/,
    /^recall\b/,
    /^show memories/,
    /\bdo you remember\b/,
    /\bwhat do you know about\b/,
    /\bwhat did i tell you about\b/,
  ];

  if (recallPatterns.some((p) => p.test(q))) {
    return "memory_recall";
  }

  // GENERAL
  const generalPatterns = [
    /^(hi|hello|hey|good morning|good evening|thanks|thank you|bye)\b/,
    /^who are you/,
    /^what are you/,
    /^what can you do/,
    /^how are you/,
  ];

  if (generalPatterns.some((p) => p.test(q))) {
    return "general";
  }

  return "erp_analysis";
}

// ============================================================
// Detect ERP modules
// ============================================================

export function detectModules(query: string): string[] {
  const q = query.toLowerCase();
  const modules: string[] = [];

  const purchaseWords = [
    "purchase",
    "supplier",
    "shop",
    "kingfisher",
    "budweiser",
    "beer",
    "bottle",
    "buy",
    "bought",
    "cheapest",
    "rate",
    "brand",
    "akividu",
    "bhimavaram",
  ];

  const salesWords = [
    "sale",
    "sold",
    "customer",
    "buyer",
    "pending",
    "payment",
    "late",
    "revenue",
    "invoice",
    "overdue",
  ];

  const attendanceWords = [
    "attendance",
    "absent",
    "present",
    "worker",
    "employee",
    "overtime",
  ];

  const expenseWords = [
    "expense",
    "diesel",
    "fuel",
    "rent",
    "salary",
    "cost",
  ];

  const stockWords = [
    "stock",
    "inventory",
    "material",
    "running low",
    "remaining",
  ];

  if (purchaseWords.some((w) => q.includes(w))) modules.push("purchases");
  if (salesWords.some((w) => q.includes(w))) modules.push("sales");
  if (attendanceWords.some((w) => q.includes(w))) modules.push("attendance");
  if (expenseWords.some((w) => q.includes(w))) modules.push("expenses");
  if (stockWords.some((w) => q.includes(w))) modules.push("stock");

  if (modules.length === 0) {
    return ["purchases", "sales", "attendance", "expenses", "stock"];
  }

  return modules;
}

// ============================================================
// SAVE MEMORY
// ============================================================

export async function saveMemory(query: string): Promise<string> {
  const fact = query
    .replace(
      /^(remember|save this|note this|note that|learn this|learn that|don't forget)\s*[:,.]?\s*/i,
      ""
    )
    .trim();

  if (!fact) {
    return "What would you like me to remember?";
  }

  try {
    await hindsight.retainMemory(fact, "Learned Business Fact", "User Fact");
    return `Noted! I've saved: "${fact}"`;
  } catch (error) {
    console.error(error);
    return "I couldn't save that memory.";
  }
}

// ============================================================
// FORGET MEMORY
// ============================================================

export async function forgetMemory(query: string): Promise<string> {
  const fact = query
    .replace(/^(forget|delete memory|remove memory)\s*/i, "")
    .trim();

  if (!fact) {
    return "What should I forget?";
  }

  const deleted = await hindsight.deleteMemory(fact);

  return deleted
    ? `Done! I forgot "${fact}".`
    : "I couldn't find that memory.";
}

// ============================================================
// RECALL MEMORY
// ============================================================

export async function recallMemories(query: string): Promise<string> {
  const subject = query
    .replace(
      /^(what do you remember about|what did you remember about|recall|show memories about|do you remember|what do you know about|what did i tell you about)\s*/i,
      ""
    )
    .replace(/\?/g, "")
    .trim();

  try {
    const memories = await hindsight.recallMemory(subject);

    if (memories.length === 0) {
      return `I don't have any saved memories about "${subject}".`;
    }

    // Remove duplicate memories
    const unique = memories.filter(
      (m, index, arr) =>
        index ===
        arr.findIndex(
          (x) => x.content.toLowerCase().trim() === m.content.toLowerCase().trim()
        )
    );

    const lines = unique.map((m) => `• ${m.content}`);

    return `Here's what I remember about "${subject}":\n${lines.join("\n")}`;
  } catch (error) {
    console.error(error);
    return "I couldn't retrieve memories.";
  }
}

// ============================================================
// ERP MEMORY LOGGER
// ============================================================

export async function logERPMemory(
  action: string,
  details: string,
  type: string
) {
  try {
    await hindsight.retainMemory(details, type, action);
  } catch (error) {
    console.error(error);
  }
}