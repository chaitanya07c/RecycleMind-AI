import { hindsight } from './hindsight';
import { supabase } from './supabase';

class CodeIn {
  async buildContext(query?: string): Promise<string> {
    try {
      console.log(query);
      
      let contextStr = "==== ERP SUPABASE LIVE DATA ====\n";
      const today = new Date().toISOString().split('T')[0];

      // 1. Fetch Purchases
      try {
        const { data: purchases, error } = await supabase.from('purchases').select('grand_total, shop_id, payment_status, date, shops(name)');
        if (error) throw error;
        if (purchases) {
          const todaysPurchases = purchases.filter(p => p.date === today);
          const totalPurchasesToday = todaysPurchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
          contextStr += `Total purchase today: ₹${totalPurchasesToday}\n`;

          const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
          contextStr += `Total Purchases (All time): ₹${totalPurchases}\n`;

          const pendingPurchases = purchases.filter(p => p.payment_status !== 'Completed');
          const totalPending = pendingPurchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
          contextStr += `Total Pending Purchase Payments: ₹${totalPending}\n`;

          const shopTotals: Record<string, number> = {};
          purchases.forEach(p => {
            const shopName = (p.shops as any)?.name || 'Unknown';
            shopTotals[shopName] = (shopTotals[shopName] || 0) + Number(p.grand_total || 0);
          });
          const maxShop = Object.entries(shopTotals).sort((a, b) => b[1] - a[1])[0];
          if (maxShop) {
            contextStr += `Shop that buys the most (we purchase from them): ${maxShop[0]} (₹${maxShop[1]})\n`;
          }
        }
      } catch (e: any) {
        console.error("Codein Supabase purchases error:", e.message || e);
        contextStr += `Purchases error: ${e.message || e}\n`;
      }

      // 2. Fetch Sales
      try {
        const { data: sales, error } = await supabase.from('sales').select('total_amount, payment_status, buyer_name, date, payment_history, partial_payment');
        if (error) throw error;
        if (sales) {
          const todaysSales = sales.filter(s => s.date === today);
          const totalSalesToday = todaysSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
          contextStr += `Total sales today: ₹${totalSalesToday}\n`;

          let todayCollections = 0;
          sales.forEach(s => {
            if (s.date === today && s.payment_status === 'Completed') {
              todayCollections += Number(s.total_amount || 0);
            } else if (s.date === today && s.payment_status === 'Partial Payment') {
              todayCollections += Number(s.partial_payment || 0);
            }
            if (Array.isArray(s.payment_history)) {
              s.payment_history.forEach((ph: any) => {
                if (ph.date === today) todayCollections += Number(ph.amount || 0);
              });
            }
          });
          contextStr += `Today's collections: ₹${todayCollections}\n`;

          const pendingSales = sales.filter(s => s.payment_status !== 'Completed');
          const pendingSalesAmount = pendingSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
          contextStr += `Pending sales amount: ₹${pendingSalesAmount}\n`;

          const buyerPending: Record<string, number> = {};
          const buyerLate: Record<string, number> = {};
          pendingSales.forEach(s => {
            buyerPending[s.buyer_name || 'Unknown'] = (buyerPending[s.buyer_name || 'Unknown'] || 0) + Number(s.total_amount || 0);
            buyerLate[s.buyer_name || 'Unknown'] = (buyerLate[s.buyer_name || 'Unknown'] || 0) + 1;
          });
          
          const maxBuyer = Object.entries(buyerPending).sort((a, b) => b[1] - a[1])[0];
          if (maxBuyer) {
            contextStr += `Customer with the highest pending payment: ${maxBuyer[0]} (₹${maxBuyer[1]})\n`;
          }
          const maxLateBuyer = Object.entries(buyerLate).sort((a, b) => b[1] - a[1])[0];
          if (maxLateBuyer) {
            contextStr += `Customer who usually pays late (highest number of pending invoices): ${maxLateBuyer[0]}\n`;
          }
        }
      } catch (e: any) {
        console.error("Codein Supabase sales error:", e.message || e);
        contextStr += `Sales error: ${e.message || e}\n`;
      }

      // 3. Fetch Items
      try {
        const { data: purchaseItems, error } = await supabase.from('purchase_items').select('item_name, quantity');
        if (error) throw error;
        if (purchaseItems) {
          const itemTotals: Record<string, number> = {};
          purchaseItems.forEach(i => {
            itemTotals[i.item_name || 'Unknown'] = (itemTotals[i.item_name || 'Unknown'] || 0) + Number(i.quantity || 0);
          });
          const maxItem = Object.entries(itemTotals).sort((a, b) => b[1] - a[1])[0];
          if (maxItem) {
            contextStr += `Highest selling/purchased item: ${maxItem[0]} (${maxItem[1]} units)\n`;
          }
        }
      } catch (e: any) {
        console.error("Codein Supabase items error:", e.message || e);
      }
      
      // 4. Fetch Attendance
      try {
        const { data: attendance, error } = await supabase.from('attendance').select('status, employees(name)').eq('date', today);
        if (error) throw error;
        if (attendance && attendance.length > 0) {
          contextStr += `Worker attendance today: ${attendance.map(a => `${(a.employees as any)?.name}: ${a.status}`).join(', ')}\n`;
        } else {
          contextStr += `Worker attendance today: No records yet.\n`;
        }
      } catch (e: any) {
        console.error("Codein Supabase attendance error:", e.message || e);
      }

      // 5. Fetch Hindsight Memories
      contextStr += "\n==== HINDSIGHT MEMORY TIMELINE ====\n";
      try {
        const memories = await hindsight.getRecentMemories(20);
        if (memories && memories.length > 0) {
          const contextLines = memories.map(m => {
            let metaString = '';
            if (m.metadata) {
              metaString = Object.entries(m.metadata).map(([k, v]) => `${k}: ${v}`).join(', ');
            }
            return `[${m.type}] ${m.title} - ${m.content} (${metaString})`;
          });
          const uniqueContext = Array.from(new Set(contextLines));
          contextStr += uniqueContext.join('\n');
        } else {
          contextStr += "No hindsight memories available.";
        }
      } catch (e: any) {
        console.error("Hindsight error inside codein:", e.message || e);
        contextStr += `Hindsight memory unavailable: ${e.message || e}. Used Supabase data only.`;
      }

      return contextStr;
    } catch (error: any) {
      console.error("Code.in failed to build context:", error.message || error);
      return `Code.in context builder failed: ${error.message || error}`;
    }
  }
}

export const codein = new CodeIn();
