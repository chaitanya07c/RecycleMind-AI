import { supabase } from './supabase';
import { hindsight } from './hindsight';

export class BusinessTools {

  /**
   * Build ERP context for the given modules.
   * All calculations happen here in TypeScript — NOT in Groq.
   */
  async fetchContext(modules: string[], query: string): Promise<string> {
    const parts: string[] = [];
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    try {
      if (modules.includes('purchases')) {
        parts.push(await this.analyzePurchases(today, thisMonth));
      }
      if (modules.includes('sales')) {
        parts.push(await this.analyzeSales(today, thisMonth));
      }
      if (modules.includes('attendance')) {
        parts.push(await this.analyzeAttendance(today, thisMonth));
      }
      if (modules.includes('expenses')) {
        parts.push(await this.analyzeExpenses(thisMonth));
      }
      if (modules.includes('stock')) {
        parts.push(await this.analyzeStock());
      }

      // Always try to include relevant memories
      parts.push(await this.fetchMemories(query));

    } catch (error) {
      console.error("BusinessTools context error:", error);
    }

    const context = parts.filter(p => p.length > 0).join('\n');
    // Limit to ~3000 chars to avoid token overflow
    return context.slice(0, 3000);
  }

  // ── Purchases ───────────────────────────────────────────────
  private async analyzePurchases(today: string, thisMonth: string): Promise<string> {
    try {
      const { data: purchases, error: pErr } = await supabase
        .from('purchases')
        .select('id, grand_total, shop_id, date, payment_status, shops(name)');
      const { data: items, error: iErr } = await supabase
        .from('purchase_items')
        .select('item_name, rate, quantity, purchase_id');

      if (pErr) { console.error("Supabase purchases error:", pErr.message); return ''; }
      if (iErr) { console.error("Supabase items error:", iErr.message); return ''; }
      if (!purchases || !items) return '';

      let out = '=== PURCHASES ===\n';

      // Totals
      const totalAll = purchases.reduce((s, p) => s + Number(p.grand_total || 0), 0);
      const todayPurchases = purchases.filter(p => p.date === today);
      const todayTotal = todayPurchases.reduce((s, p) => s + Number(p.grand_total || 0), 0);
      const monthPurchases = purchases.filter(p => p.date?.startsWith(thisMonth));
      const monthTotal = monthPurchases.reduce((s, p) => s + Number(p.grand_total || 0), 0);

      // Previous month
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStr = prevMonth.toISOString().slice(0, 7);
      const prevMonthTotal = purchases.filter(p => p.date?.startsWith(prevMonthStr))
        .reduce((s, p) => s + Number(p.grand_total || 0), 0);

      out += `Today: ₹${todayTotal} | This month: ₹${monthTotal} | Last month: ₹${prevMonthTotal} | All-time: ₹${totalAll}\n`;

      // Shop ranking
      const shopTotals: Record<string, number> = {};
      purchases.forEach(p => {
        const sName = (p.shops as any)?.name || 'Unknown';
        shopTotals[sName] = (shopTotals[sName] || 0) + Number(p.grand_total || 0);
      });
      const shopRanking = Object.entries(shopTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
      out += `Top suppliers: ${shopRanking.map(([n, a]) => `${n} ₹${a}`).join(', ')}\n`;

      // Cheapest supplier per item
      const itemCosts: Record<string, Record<string, { qty: number; cost: number }>> = {};
      purchases.forEach(p => {
        const sName = (p.shops as any)?.name || 'Unknown';
        const pItems = items.filter(i => i.purchase_id === p.id);
        pItems.forEach(i => {
          const name = i.item_name || 'Unknown';
          if (!itemCosts[name]) itemCosts[name] = {};
          if (!itemCosts[name][sName]) itemCosts[name][sName] = { qty: 0, cost: 0 };
          itemCosts[name][sName].qty += Number(i.quantity || 0);
          itemCosts[name][sName].cost += Number(i.quantity || 0) * Number(i.rate || 0);
        });
      });

      out += 'Cheapest supplier per item:\n';
      Object.entries(itemCosts).slice(0, 8).forEach(([itemName, shopData]) => {
        const ranked = Object.entries(shopData)
          .map(([shop, s]) => ({ shop, avg: s.qty > 0 ? s.cost / s.qty : Infinity }))
          .sort((a, b) => a.avg - b.avg);
        if (ranked.length > 0 && ranked[0].avg !== Infinity) {
          out += `- ${itemName}: ${ranked[0].shop} (Avg ₹${ranked[0].avg.toFixed(2)})`;
          if (ranked.length > 1 && ranked[1].avg !== Infinity) {
            out += ` vs ${ranked[1].shop} (₹${ranked[1].avg.toFixed(2)})`;
          }
          out += '\n';
        }
      });

      return out;
    } catch (e: any) {
      console.error("Purchase analysis error:", e.message || e);
      return '';
    }
  }

  // ── Sales ───────────────────────────────────────────────────
  private async analyzeSales(today: string, thisMonth: string): Promise<string> {
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('total_amount, buyer_name, date, payment_status, payment_history, partial_payment');
      if (error) { console.error("Supabase sales error:", error.message); return ''; }
      if (!sales) return '';

      let out = '=== SALES ===\n';

      const totalAll = sales.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const todaySales = sales.filter(s => s.date === today);
      const todayTotal = todaySales.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const monthSales = sales.filter(s => s.date?.startsWith(thisMonth));
      const monthTotal = monthSales.reduce((s, r) => s + Number(r.total_amount || 0), 0);

      // Previous month
      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStr = prevMonth.toISOString().slice(0, 7);
      const prevMonthTotal = sales.filter(s => s.date?.startsWith(prevMonthStr))
        .reduce((s, r) => s + Number(r.total_amount || 0), 0);

      out += `Today: ₹${todayTotal} | This month: ₹${monthTotal} | Last month: ₹${prevMonthTotal} | All-time: ₹${totalAll}\n`;

      // Today's collections
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
      out += `Today's collections: ₹${todayCollections}\n`;

      // Pending & payment delays
      const buyerPending: Record<string, number> = {};
      const buyerDelays: Record<string, { totalDays: number; maxDelay: number; invoiceCount: number }> = {};
      let totalPending = 0;

      sales.forEach(s => {
        if (s.payment_status !== 'Completed') {
          buyerPending[s.buyer_name] = (buyerPending[s.buyer_name] || 0) + Number(s.total_amount || 0);
          totalPending += Number(s.total_amount || 0);
        }

        // Calculate payment delay for completed invoices
        if (s.payment_status === 'Completed' && Array.isArray(s.payment_history) && s.payment_history.length > 0) {
          const saleDate = new Date(s.date).getTime();
          const lastPay = new Date(s.payment_history[s.payment_history.length - 1].date).getTime();
          const days = Math.max(0, (lastPay - saleDate) / (1000 * 3600 * 24));
          if (!buyerDelays[s.buyer_name]) buyerDelays[s.buyer_name] = { totalDays: 0, maxDelay: 0, invoiceCount: 0 };
          buyerDelays[s.buyer_name].totalDays += days;
          buyerDelays[s.buyer_name].invoiceCount += 1;
          if (days > buyerDelays[s.buyer_name].maxDelay) buyerDelays[s.buyer_name].maxDelay = days;
        }
      });

      out += `Total pending: ₹${totalPending}\n`;

      // Highest pending
      const pendingRanked = Object.entries(buyerPending).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (pendingRanked.length > 0) {
        out += `Highest pending: ${pendingRanked.map(([n, a]) => `${n} ₹${a}`).join(', ')}\n`;
      }

      // Late payers
      const delayRanked = Object.entries(buyerDelays)
        .map(([buyer, d]) => ({ buyer, avg: d.invoiceCount > 0 ? d.totalDays / d.invoiceCount : 0, max: d.maxDelay, count: d.invoiceCount, pending: buyerPending[buyer] || 0 }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5);

      if (delayRanked.length > 0) {
        out += 'Payment delays:\n';
        delayRanked.forEach(d => {
          out += `- ${d.buyer}: avg ${d.avg.toFixed(1)} days, max ${d.max.toFixed(0)} days across ${d.count} invoices, pending ₹${d.pending}\n`;
        });
      }

      // Best customer (highest revenue)
      const buyerRevenue: Record<string, number> = {};
      sales.forEach(s => {
        buyerRevenue[s.buyer_name] = (buyerRevenue[s.buyer_name] || 0) + Number(s.total_amount || 0);
      });
      const topBuyers = Object.entries(buyerRevenue).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (topBuyers.length > 0) {
        out += `Top customers: ${topBuyers.map(([n, a]) => `${n} ₹${a}`).join(', ')}\n`;
      }

      return out;
    } catch (e: any) {
      console.error("Sales analysis error:", e.message || e);
      return '';
    }
  }

  // ── Attendance ──────────────────────────────────────────────
  private async analyzeAttendance(today: string, _thisMonth: string): Promise<string> {
    try {
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('status, date, employees(name)');
      if (error) { console.error("Supabase attendance error:", error.message); return ''; }
      if (!attendance || attendance.length === 0) return 'Attendance: No records found.\n';

      let out = '=== ATTENDANCE ===\n';

      const workerStats: Record<string, { present: number; absent: number; total: number }> = {};
      attendance.forEach(a => {
        const name = (a.employees as any)?.name || 'Unknown';
        if (!workerStats[name]) workerStats[name] = { present: 0, absent: 0, total: 0 };
        workerStats[name].total += 1;
        if (a.status === 'Present') workerStats[name].present += 1;
        if (a.status === 'Absent') workerStats[name].absent += 1;
      });

      // Today
      const todayRecords = attendance.filter(a => a.date === today);
      if (todayRecords.length > 0) {
        out += `Today: ${todayRecords.map(a => `${(a.employees as any)?.name}: ${a.status}`).join(', ')}\n`;
      }

      // Ranking by attendance %
      const ranked = Object.entries(workerStats)
        .map(([name, s]) => ({ name, pct: (s.present / s.total) * 100, absent: s.absent, total: s.total }))
        .sort((a, b) => b.pct - a.pct);

      ranked.forEach((w, idx) => {
        out += `- Rank ${idx + 1}: ${w.name} — ${w.pct.toFixed(1)}% present, ${w.absent} days absent out of ${w.total}\n`;
      });

      return out;
    } catch (e: any) {
      console.error("Attendance analysis error:", e.message || e);
      return '';
    }
  }

  // ── Expenses ────────────────────────────────────────────────
  private async analyzeExpenses(thisMonth: string): Promise<string> {
    try {
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select('amount, category, date');
      if (error) { console.error("Supabase expenses error:", error.message); return ''; }
      if (!expenses || expenses.length === 0) return 'Expenses: No records found.\n';

      let out = '=== EXPENSES ===\n';

      const prevMonth = new Date();
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStr = prevMonth.toISOString().slice(0, 7);

      // Group by month + category
      const monthly: Record<string, Record<string, number>> = {};
      expenses.forEach(e => {
        const m = e.date?.slice(0, 7) || 'unknown';
        if (!monthly[m]) monthly[m] = {};
        monthly[m][e.category] = (monthly[m][e.category] || 0) + Number(e.amount || 0);
      });

      // This month
      const thisMonthData = monthly[thisMonth] || {};
      const thisMonthTotal = Object.values(thisMonthData).reduce((s, v) => s + v, 0);
      out += `This month total: ₹${thisMonthTotal}\n`;
      Object.entries(thisMonthData).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
        out += `- ${cat}: ₹${amt}\n`;
      });

      // Previous month comparison
      const prevMonthData = monthly[prevMonthStr] || {};
      const prevMonthTotal = Object.values(prevMonthData).reduce((s, v) => s + v, 0);
      if (prevMonthTotal > 0) {
        out += `Last month total: ₹${prevMonthTotal}\n`;
      }

      return out;
    } catch (e: any) {
      console.error("Expenses analysis error:", e.message || e);
      return '';
    }
  }

  // ── Stock ───────────────────────────────────────────────────
  private async analyzeStock(): Promise<string> {
    try {
      const { data: stock, error } = await supabase
        .from('materials')
        .select('name, stock, minimum_stock');
      if (error) { console.error("Supabase stock error:", error.message); return ''; }
      if (!stock || stock.length === 0) return 'Stock: No records found.\n';

      let out = '=== STOCK ===\n';
      const lowStock: string[] = [];

      stock.forEach(s => {
        const status = (s.stock ?? 0) < (s.minimum_stock ?? 0) ? 'LOW' : 'OK';
        out += `- ${s.name}: ${s.stock ?? 0} units (Min: ${s.minimum_stock ?? 0}) [${status}]\n`;
        if (status === 'LOW') lowStock.push(s.name);
      });

      if (lowStock.length > 0) {
        out += `⚠ Low stock alert: ${lowStock.join(', ')}\n`;
      }

      return out;
    } catch (e: any) {
      console.error("Stock analysis error:", e.message || e);
      return '';
    }
  }

  // ── Memories ────────────────────────────────────────────────
  private async fetchMemories(query: string): Promise<string> {
    try {
      const memories = await hindsight.recallMemory(query);
      if (memories.length === 0) return '';
      let out = '=== MEMORIES ===\n';
      memories.slice(0, 5).forEach(m => {
        out += `- ${m.content}\n`;
      });
      return out;
    } catch (e) {
      console.error("Memory fetch error:", e);
      return '';
    }
  }
}

export const businessTools = new BusinessTools();
