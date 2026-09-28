import { supabase } from './supabase';
import { hindsight } from './hindsight';

export class BusinessTools {
  async fetchContext(intents: string[], query: string): Promise<string> {
    let contextStr = "==== ANALYZED ERP DATA ====\n";

    if (intents.includes('purchases')) {
      const { data: purchases } = await supabase.from('purchases').select('grand_total, shop_id, date, payment_status, shops(name)');
      const { data: items } = await supabase.from('purchase_items').select('item_name, rate, quantity, purchases(date)');
      
      if (purchases) {
        const total = purchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthPurchases = purchases.filter(p => p.date?.startsWith(thisMonth));
        const monthTotal = monthPurchases.reduce((sum, p) => sum + Number(p.grand_total || 0), 0);
        
        const shopTotals: Record<string, number> = {};
        purchases.forEach(p => {
          const sName = (p.shops as any)?.name || 'Unknown';
          shopTotals[sName] = (shopTotals[sName] || 0) + Number(p.grand_total || 0);
        });

        contextStr += `Purchases:\nTotal purchases all-time: ₹${total}\nThis month: ₹${monthTotal}\n`;
        Object.entries(shopTotals).forEach(([shop, amt]) => {
          contextStr += `- ${shop}: ₹${amt}\n`;
        });
      }

      if (items) {
        const itemStats: Record<string, {totalQty: number, totalCost: number}> = {};
        items.forEach(i => {
          if (!itemStats[i.item_name]) itemStats[i.item_name] = { totalQty: 0, totalCost: 0 };
          itemStats[i.item_name].totalQty += Number(i.quantity || 0);
          itemStats[i.item_name].totalCost += (Number(i.quantity || 0) * Number(i.rate || 0));
        });
        
        contextStr += `Item Averages:\n`;
        Object.entries(itemStats).forEach(([name, stats]) => {
          const avg = stats.totalQty > 0 ? stats.totalCost / stats.totalQty : 0;
          contextStr += `- ${name}: avg ₹${avg.toFixed(2)}\n`;
        });
      }
    }

    if (intents.includes('sales')) {
      const { data: sales } = await supabase.from('sales').select('total_amount, buyer_name, date, payment_status, payment_history');
      if (sales) {
        const thisMonth = new Date().toISOString().slice(0, 7);
        const monthSales = sales.filter(s => s.date?.startsWith(thisMonth));
        const monthTotal = monthSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
        
        const buyerPending: Record<string, number> = {};
        const buyerDelays: Record<string, {totalDays: number, count: number}> = {};
        
        sales.forEach(s => {
          if (s.payment_status !== 'Completed') {
            buyerPending[s.buyer_name] = (buyerPending[s.buyer_name] || 0) + Number(s.total_amount || 0);
          }
          
          if (s.payment_status === 'Completed' && s.payment_history && s.payment_history.length > 0) {
            const saleDate = new Date(s.date).getTime();
            const lastPaymentDate = new Date(s.payment_history[s.payment_history.length - 1].date).getTime();
            const daysDiff = (lastPaymentDate - saleDate) / (1000 * 3600 * 24);
            if (daysDiff > 0) {
              if (!buyerDelays[s.buyer_name]) buyerDelays[s.buyer_name] = { totalDays: 0, count: 0 };
              buyerDelays[s.buyer_name].totalDays += daysDiff;
              buyerDelays[s.buyer_name].count += 1;
            }
          }
        });

        contextStr += `\nSales:\nThis month sales: ₹${monthTotal}\nPending Balances:\n`;
        Object.entries(buyerPending).forEach(([buyer, amt]) => {
          if (amt > 0) contextStr += `- ${buyer}: ₹${amt}\n`;
        });
        contextStr += `Payment Delays (avg days):\n`;
        Object.entries(buyerDelays).forEach(([buyer, d]) => {
          contextStr += `- ${buyer}: ${(d.totalDays / d.count).toFixed(1)} days\n`;
        });
      }
    }

    if (intents.includes('attendance')) {
      const { data: attendance } = await supabase.from('attendance').select('status, date, employees(name)');
      if (attendance) {
        const workerStats: Record<string, {present: number, absent: number, total: number}> = {};
        attendance.forEach(a => {
          const name = (a.employees as any)?.name || 'Unknown';
          if (!workerStats[name]) workerStats[name] = {present: 0, absent: 0, total: 0};
          workerStats[name].total += 1;
          if (a.status === 'Present') workerStats[name].present += 1;
          if (a.status === 'Absent') workerStats[name].absent += 1;
        });
        
        contextStr += `\nAttendance:\n`;
        Object.entries(workerStats).forEach(([name, stats]) => {
          const pct = (stats.present / stats.total) * 100;
          contextStr += `- ${name}: ${pct.toFixed(1)}% present (${stats.absent} days absent)\n`;
        });
      }
    }
    
    if (intents.includes('expenses')) {
      const { data: expenses } = await supabase.from('expenses').select('amount, category, date');
      if (expenses) {
        const cats: Record<string, number> = {};
        expenses.forEach(e => {
          cats[e.category] = (cats[e.category] || 0) + Number(e.amount || 0);
        });
        contextStr += `\nExpenses:\n`;
        Object.entries(cats).forEach(([cat, amt]) => {
          contextStr += `- ${cat}: ₹${amt}\n`;
        });
      }
    }

    // Always fetch memory if it's explicitly asked or just generally
    if (intents.includes('memory') || intents.length === 0) {
      const memories = await hindsight.recallMemory(query);
      if (memories.length > 0) {
        contextStr += `\nLong-term Memories:\n`;
        memories.forEach(m => {
          contextStr += `- ${m.content}\n`;
        });
      }
    }

    return contextStr;
  }
}

export const businessTools = new BusinessTools();
