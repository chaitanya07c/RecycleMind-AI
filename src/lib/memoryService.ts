import { hindsight } from './hindsight';

const memoryKeywords = [
  "remember this",
  "note this",
  "don't forget",
  "always",
  "usually",
  "pays fast",
  "pays late"
];

export async function processUserMemory(query: string): Promise<string | null> {
  const lowerQuery = query.toLowerCase();
  
  const shouldRemember = memoryKeywords.some(kw => lowerQuery.includes(kw));
  
  if (shouldRemember) {
    // Determine title based on content
    let title = "User Fact";
    if (lowerQuery.includes("pays fast")) title = "Fast Payer";
    else if (lowerQuery.includes("pays late")) title = "Late Payer";
    else if (lowerQuery.includes("always") || lowerQuery.includes("usually")) title = "Business Rule";
    
    // Clean up the query to store as fact if they said "Remember this."
    const contentToRemember = query.replace(/remember this/i, '').replace(/note this/i, '').replace(/don't forget/i, '').trim();
    
    await hindsight.retainMemory(contentToRemember || query, 'Learned Memory', title);
    
    return `I'll remember that: ${contentToRemember || query}`;
  }
  
  return null;
}

export async function logERPMemory(action: string, details: string, type: string) {
  try {
    await hindsight.retainMemory(details, type, action);
  } catch (error) {
    console.error("Failed to log ERP memory:", error);
  }
}
