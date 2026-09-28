export interface Memory {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: any;
  timestamp: string;
}

const hindsightKey = import.meta.env.VITE_HINDSIGHT_API_KEY || localStorage.getItem('VITE_HINDSIGHT_API_KEY');
const hindsightProjectId = import.meta.env.VITE_HINDSIGHT_PROJECT_ID || 'default';

class Hindsight {
  private key = 'hindsight_memories';

  constructor() {
    console.log("Hindsight Project ID:", hindsightProjectId);
  }

  private getMemories(): Memory[] {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  private saveMemories(memories: Memory[]) {
    localStorage.setItem(this.key, JSON.stringify(memories));
  }

  async createMemory(memory: Omit<Memory, 'id' | 'timestamp'>) {
    if (!hindsightKey) {
      console.warn("Hindsight API key not configured. Using local fallback.");
    }
    try {
      const memories = this.getMemories();
      const newMemory: Memory = {
        ...memory,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      };
      memories.unshift(newMemory);
      this.saveMemories(memories);
      return newMemory;
    } catch (e: any) {
      console.error("Hindsight failed to create memory:", e.message || e);
      // Never block business operations
    }
  }

  async getRecentMemories(limit: number = 50): Promise<Memory[]> {
    if (!hindsightKey) {
      console.warn("Hindsight API key not configured. Using local fallback.");
    }
    return this.getMemories().slice(0, limit);
  }

  async getMemoriesByType(type: string): Promise<Memory[]> {
    return this.getMemories().filter(m => m.type === type);
  }
}

export const hindsight = new Hindsight();
