import { getDepletionData } from "./scanHistory";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface OrderDeadline {
  product: string;
  currentStock: number;
  avgPerDay: number;
  runsOutDate: Date;
  orderByDate: Date;
  orderByLabel: string;
  urgency: "today" | "tomorrow" | "this_week" | "safe";
}

export function calculateDeadlines(): OrderDeadline[] {
  const depletionData = getDepletionData();
  const now = new Date();

  return depletionData
    .filter((d) => d.avgPerDay > 0)
    .map((d) => {
      const daysLeft = d.currentStock / d.avgPerDay;
      const runsOutDate = new Date(now.getTime() + daysLeft * 86400000);
      const orderByDate = new Date(runsOutDate.getTime() - 86400000); // 1 day before

      const daysDiff = Math.floor((orderByDate.getTime() - now.getTime()) / 86400000);
      let urgency: OrderDeadline["urgency"];
      if (daysDiff <= 0) urgency = "today";
      else if (daysDiff === 1) urgency = "tomorrow";
      else if (daysDiff <= 6) urgency = "this_week";
      else urgency = "safe";

      const weekday = WEEKDAYS[orderByDate.getDay()];
      const dateStr = `${orderByDate.getDate()}/${orderByDate.getMonth() + 1}`;
      const orderByLabel = `${weekday} ${dateStr}`;

      return {
        product: d.name,
        currentStock: d.currentStock,
        avgPerDay: d.avgPerDay,
        runsOutDate,
        orderByDate,
        orderByLabel,
        urgency,
      };
    })
    .sort((a, b) => a.orderByDate.getTime() - b.orderByDate.getTime());
}
