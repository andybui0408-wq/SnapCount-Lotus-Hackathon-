import { useState } from "react";
import OrderDeadlinesCard from "../components/OrderDeadlinesCard";
import StockBars from "../components/StockBars";
import RevenueStrip from "../components/RevenueStrip";
import PriceEditor from "../components/PriceEditor";
import EmailReportButton from "../components/EmailReportButton";

export default function DashboardPage() {
  const [showPriceEditor, setShowPriceEditor] = useState(false);

  return (
    <div className="page">
      <h1>Dashboard</h1>

      {/* Order deadline cards */}
      <OrderDeadlinesCard />

      {/* C) Visual stock bars */}
      <div className="section">
        <h2 className="section-heading">Tồn kho</h2>
        <StockBars />
      </div>

      {/* D) Revenue estimate strip */}
      <RevenueStrip onOpenPriceEditor={() => setShowPriceEditor(true)} />

      {/* E) Email Report button */}
      <EmailReportButton />

      {/* F) Price editor modal */}
      {showPriceEditor && <PriceEditor onClose={() => setShowPriceEditor(false)} />}
    </div>
  );
}
