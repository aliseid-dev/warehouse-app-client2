// src/components/Layout.jsx
import BottomNav from "./BottomNav";

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <div className="page-content">{children}</div>
      <BottomNav />
    </div>
  );
};

export default Layout;