import { useState, useMemo } from "react";
import VocabularyEditor from "../components/VocabularyEditor";
import CatalogBuilder from "../components/CatalogBuilder";
import { clearAllData, getDepletionData, removeProductFromHistory } from "../services/scanHistory";
import { removeFromCatalog } from "../services/productCatalog";
import { removeFromVocabulary } from "../services/groundingDinoAPI";
import { removePrice } from "../services/priceStore";

export default function ProfilePage() {
  const [email, setEmail] = useState(() => localStorage.getItem("countr_email") || "");
  const [shopName, setShopName] = useState(() => localStorage.getItem("countr_shop_name") || "");
  const [showVocab, setShowVocab] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const products = useMemo(() => getDepletionData(), [refreshKey]);

  const handleEmailSave = () => {
    localStorage.setItem("countr_email", email);
  };

  const handleShopNameSave = () => {
    localStorage.setItem("countr_shop_name", shopName);
  };

  const handleRemoveProduct = (name: string) => {
    if (!confirm(`Xóa "${name}" khỏi cửa hàng?`)) return;
    removeProductFromHistory(name);
    removeFromCatalog(name);
    removeFromVocabulary(name);
    removePrice(name);
    setRefreshKey((k) => k + 1);
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

      {/* Product list — remove individual products */}
      {products.length > 0 && (
        <div className="profile-section">
          <div className="profile-section-title">San pham ({products.length})</div>
          {products.map((p) => (
            <div key={p.name} className="profile-product-row">
              <div className="profile-product-info">
                <span className="profile-product-name">{p.name}</span>
                <span className="profile-product-stock mono">{p.currentStock} con lai</span>
              </div>
              <button
                className="profile-product-remove"
                onClick={() => handleRemoveProduct(p.name)}
                title="Xóa sản phẩm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Clear all data */}
      <div className="profile-section">
        <div className="profile-section-title">Du lieu</div>
        <button
          className="btn btn-danger"
          style={{ width: "100%", marginTop: 4 }}
          onClick={handleClearAll}
          disabled={cleared}
        >
          {cleared ? "Da xoa — dang tai lai..." : "Xoa tat ca du lieu"}
        </button>
        <p className="text-secondary" style={{ fontSize: 11, marginTop: 4 }}>
          Xoa lich su quet, catalog, gia, tu vung phat hien
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
