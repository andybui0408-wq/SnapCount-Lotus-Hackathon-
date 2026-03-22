import { useState } from "react";
import VocabularyEditor from "../components/VocabularyEditor";
import CatalogBuilder from "../components/CatalogBuilder";
import { clearAllData } from "../services/scanHistory";

export default function ProfilePage() {
  const [email, setEmail] = useState(() => localStorage.getItem("countr_email") || "");
  const [shopName, setShopName] = useState(() => localStorage.getItem("countr_shop_name") || "");
  const [showVocab, setShowVocab] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleEmailSave = () => {
    localStorage.setItem("countr_email", email);
  };

  const handleShopNameSave = () => {
    localStorage.setItem("countr_shop_name", shopName);
  };

  const handleClearAll = () => {
    if (!confirm("Xóa tất cả dữ liệu? Hành động này không thể hoàn tác.")) return;
    clearAllData();
    setCleared(true);
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="page">
      <h1>Profile</h1>

      {/* Shop Name */}
      <div className="profile-section">
        <div className="profile-section-title">Shop Name</div>
        <input
          type="text"
          className="profile-email-input"
          placeholder="Your shop name"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          onBlur={handleShopNameSave}
        />
      </div>

      {/* Email */}
      <div className="profile-section">
        <div className="profile-section-title">Email</div>
        <input
          type="email"
          className="profile-email-input"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailSave}
        />
      </div>

      {/* Settings links */}
      <div className="profile-section">
        <div className="profile-section-title">Settings</div>
        <button className="profile-item" onClick={() => setShowVocab(true)}>
          <span className="profile-item-label">Detection Vocabulary</span>
          <span className="profile-item-arrow">&rsaquo;</span>
        </button>
        <button className="profile-item" onClick={() => setShowCatalog(true)}>
          <span className="profile-item-label">Product Catalog</span>
          <span className="profile-item-arrow">&rsaquo;</span>
        </button>
      </div>

      {/* Clear all data */}
      <div className="profile-section">
        <div className="profile-section-title">Dữ liệu</div>
        <button
          className="btn btn-danger"
          style={{ width: "100%", marginTop: 4 }}
          onClick={handleClearAll}
          disabled={cleared}
        >
          {cleared ? "Đã xóa — đang tải lại..." : "Xóa tất cả dữ liệu"}
        </button>
        <p className="text-secondary" style={{ fontSize: 11, marginTop: 4 }}>
          Xóa lịch sử quét, catalog, giá, từ vựng phát hiện
        </p>
      </div>

      {/* About */}
      <div className="profile-about">
        <div className="profile-about-brand">COUNTR.</div>
        <div className="profile-about-tagline">Precision Inventory Intelligence</div>
      </div>

      {showVocab && <VocabularyEditor onClose={() => setShowVocab(false)} />}
      {showCatalog && <CatalogBuilder onClose={() => setShowCatalog(false)} />}
    </div>
  );
}
