import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('VITE_GROQ_API_KEY');

const groq = new Groq({
  apiKey: apiKey || 'dummy-key',
  dangerouslyAllowBrowser: true,
});

export async function generateAIResponse(prompt: string, context: string): Promise<string> {
  if (!apiKey) {
    return "API Key missing. Please set VITE_GROQ_API_KEY.";
  }
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are RecycleMind AI, an intelligent memory agent for a recycling business. Answer queries accurately based ONLY on the provided context. If data is unavailable, say 'No business record found.' Do not hallucinate."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${prompt}`
        }
      ],
      model: "llama-3.1-8b-instant",
    });

    return response.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.error("Groq generation error:", error);
    return "An error occurred while generating the response.";
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
