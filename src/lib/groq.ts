import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('VITE_GROQ_API_KEY');

const groq = new Groq({
  apiKey: apiKey || 'dummy-key',
  dangerouslyAllowBrowser: true,
});

export async function generateAIResponse(prompt: string, context: string): Promise<string> {
  if (!apiKey) {
    return "Groq API key not configured. Please add VITE_GROQ_API_KEY to your .env file.";
  }
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an AI ERP Analyst for Siva Durga Traders, a recycling and bottle distribution business.

Rules:
- Answer using ONLY the analyzed data provided below. Never invent numbers.
- Keep responses short and conversational: 2–6 lines max unless the user asks for details.
- Do NOT use large markdown tables. Use short bullet points only when listing 3+ items.
- If data shows no results, say "No business records found for that query."
- Merge any long-term memories naturally into your answer.
- Never say "I'll remember that" unless the user explicitly asked you to remember.
- Use ₹ for currency. Use Indian number formatting.`
        },
        {
          role: "user",
          content: `Analyzed ERP Data:\n${context}\n\nUser Question: ${prompt}`
        }
      ],
      model: "llama-3.1-8b-instant",
    });

    return response.choices[0]?.message?.content || "No response generated.";
  } catch (error: any) {
    console.error("Groq generation error:", error.message || error);
    // Fallback: return the raw context so the user still gets data
    if (context && context.length > 50) {
      return `I couldn't generate a natural response, but here's what the data shows:\n${context.slice(0, 500)}`;
    }
    return `Groq API Error: ${error.message || "Failed to generate response."}`;
  }
}

export async function generateGeneralResponse(prompt: string): Promise<string> {
  if (!apiKey) {
    return "I'm RecycleMind AI, your ERP business assistant. Ask me anything about your business data!";
  }
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are RecycleMind AI, a friendly business assistant for Siva Durga Traders. Reply conversationally in 1–3 lines. You help with ERP data analysis, business intelligence, and remembering business facts."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
    });
    return response.choices[0]?.message?.content || "Hello! Ask me about your business.";
  } catch (error: any) {
    console.error("Groq general error:", error.message || error);
    return "Hello! I'm RecycleMind AI. Ask me anything about your business data.";
  }
}

export async function generateInsights(context: string): Promise<string[]> {
  if (!apiKey) return ["Missing API Key"];
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are RecycleMind AI. Generate 3 short bullet point insights about the business based on the context. Return ONLY the 3 bullet points separated by newlines."
        },
        {
          role: "user",
          content: `Context:\n${context}`
        }
      ],
      model: "llama-3.1-8b-instant",
    });

    const content = response.choices[0]?.message?.content || "";
    return content.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
  } catch (error) {
    console.error("Groq generation error:", error);
    return ["Failed to load insights"];
  }
}
