import { supabase } from './supabase';
import { hindsight } from './hindsight';

export class BusinessTools {
  async fetchContext(intents: string[], query: string): Promise<string> {
    let contextStr = "==== ANALYZED ERP DATA ====\n";

    if (intents.includes('purchases')) {
      const { data: purchases } = await supabase.from('purchases').select('id, grand_total, shop_id, date, payment_status, shops(name)');
      const { data: items } = await supabase.from('purchase_items').select('item_name, rate, quantity, purchase_id');
      
      if (purchases && items) {
        // Cheapest Supplier Calculation
        const itemCosts: Record<string, Record<string, { qty: number; cost: number }>> = {};
        
        purchases.forEach(p => {
          const sName = (p.shops as any)?.name || 'Unknown';
          const pItems = items.filter(i => i.purchase_id === p.id);
          pItems.forEach(i => {
            const name = i.item_name || 'Unknown';
            if (!itemCosts[name]) itemCosts[name] = {};
            if (!itemCosts[name][sName]) itemCosts[name][sName] = { qty: 0, cost: 0 };
            itemCosts[name][sName].qty += Number(i.quantity || 0);
            itemCosts[name][sName].cost += (Number(i.quantity || 0) * Number(i.rate || 0));
          });
        });

        contextStr += `Cheapest Suppliers by Item:\n`;
        Object.entries(itemCosts).slice(0, 10).forEach(([itemName, shopData]) => {
          let bestShop = '';
          let bestAvg = Infinity;
          Object.entries(shopData).forEach(([shop, stats]) => {
            const avg = stats.qty > 0 ? stats.cost / stats.qty : Infinity;
            if (avg < bestAvg) {
              bestAvg = avg;
              bestShop = shop;
            }
          });
          if (bestAvg !== Infinity) {
            contextStr += `- ${itemName}: ${bestShop} (Avg ₹${bestAvg.toFixed(2)})\n`;
          }
        });
      }
    }

    if (intents.includes('sales')) {
      const { data: sales } = await supabase.from('sales').select('total_amount, buyer_name, date, payment_status, payment_history');
      if (sales) {
        const buyerPending: Record<string, number> = {};
        const buyerDelays: Record<string, {totalDays: number, maxDelay: number, count: number}> = {};
        let totalPending = 0;
        
        sales.forEach(s => {
          if (s.payment_status !== 'Completed') {
            buyerPending[s.buyer_name] = (buyerPending[s.buyer_name] || 0) + Number(s.total_amount || 0);
            totalPending += Number(s.total_amount || 0);
          }
          
          if (s.payment_status === 'Completed' && s.payment_history && s.payment_history.length > 0) {
            const saleDate = new Date(s.date).getTime();
            const lastPaymentDate = new Date(s.payment_history[s.payment_history.length - 1].date).getTime();
            const daysDiff = Math.max(0, (lastPaymentDate - saleDate) / (1000 * 3600 * 24));
            
            if (!buyerDelays[s.buyer_name]) buyerDelays[s.buyer_name] = { totalDays: 0, maxDelay: 0, count: 0 };
            buyerDelays[s.buyer_name].totalDays += daysDiff;
            buyerDelays[s.buyer_name].count += 1;
            if (daysDiff > buyerDelays[s.buyer_name].maxDelay) buyerDelays[s.buyer_name].maxDelay = daysDiff;
          }
        });

        contextStr += `\nSales Analysis:\n`;
        contextStr += `Total Pending Sales: ₹${totalPending}\n`;
        Object.entries(buyerDelays).forEach(([buyer, d]) => {
          const avgDelay = d.count > 0 ? (d.totalDays / d.count).toFixed(1) : 0;
          const pending = buyerPending[buyer] || 0;
          contextStr += `- ${buyer}: Avg delay ${avgDelay} days (Max ${d.maxDelay.toFixed(0)}), Pending: ₹${pending}\n`;
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
        const sortedWorkers = Object.entries(workerStats).sort((a, b) => b[1].present - a[1].present);
        sortedWorkers.forEach(([name, stats], idx) => {
          const pct = (stats.present / stats.total) * 100;
          contextStr += `- Rank ${idx + 1}: ${name} - ${pct.toFixed(1)}% present (${stats.absent} days absent)\n`;
        });
      }
    }
    
    if (intents.includes('expenses')) {
      const { data: expenses } = await supabase.from('expenses').select('amount, category, date');
      if (expenses) {
        const cats: Record<string, Record<string, number>> = {};
        expenses.forEach(e => {
          const month = e.date.slice(0, 7);
          if (!cats[month]) cats[month] = {};
          cats[month][e.category] = (cats[month][e.category] || 0) + Number(e.amount || 0);
        });
        contextStr += `\nExpenses Summary:\n`;
        Object.entries(cats).slice(-2).forEach(([month, categories]) => {
          contextStr += `Month: ${month}\n`;
          Object.entries(categories).forEach(([cat, amt]) => {
            contextStr += `  - ${cat}: ₹${amt}\n`;
          });
        });
      }
    }

    if (intents.includes('stock')) {
      const { data: stock } = await supabase.from('materials').select('name, stock, minimum_stock');
      if (stock) {
        contextStr += `\nStock Levels:\n`;
        stock.forEach(s => {
          const status = s.stock < s.minimum_stock ? 'LOW' : 'OK';
          contextStr += `- ${s.name}: ${s.stock} (Min: ${s.minimum_stock}) [${status}]\n`;
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

    // Limit context length to avoid huge payload
    return contextStr.slice(0, 3000);
  }
}

export const businessTools = new BusinessTools();

