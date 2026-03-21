import { useMemo } from "react";
import { calculateDeadlines } from "../services/orderDeadlines";
import type { OrderDeadline } from "../services/orderDeadlines";

export default function OrderDeadlinesCard() {
  const deadlines = useMemo(() => {
    return calculateDeadlines().filter((d) => d.urgency !== "safe");
  }, []);

  if (deadlines.length === 0) {
    return null;
  }

  return (
    <div className="deadlines-section">
      <h2 className="section-heading">Đặt hàng trước</h2>
      <div className="deadlines-list">
        {deadlines.map((d) => (
          <DeadlineCard key={d.product} deadline={d} />
        ))}
      </div>
    </div>
  );
}

function DeadlineCard({ deadline }: { deadline: OrderDeadline }) {
  const pillClass =
    deadline.urgency === "today" ? "deadline-pill-urgent" :
    deadline.urgency === "tomorrow" ? "deadline-pill-tomorrow" :
    "deadline-pill-week";

  const pillText =
    deadline.urgency === "today" ? "ĐẶT NGAY" :
    deadline.urgency === "tomorrow" ? "Ngày mai" :
    deadline.orderByLabel;

  const runsOutLabel = `${deadline.runsOutDate.getDate()}/${deadline.runsOutDate.getMonth() + 1}`;

  return (
    <div className="deadline-card">
      <div className="deadline-header">
        <span className="deadline-product">{deadline.product}</span>
        <span className={`deadline-pill ${pillClass}`}>{pillText}</span>
      </div>
      <div className="deadline-detail">
        Còn {deadline.currentStock} · Hết: {runsOutLabel}
      </div>
    </div>
  );
}
