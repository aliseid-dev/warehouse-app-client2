import { useLocation, useNavigate } from 'react-router-dom';
import { FaBox, FaChartBar, FaExchangeAlt, FaMoneyBillWave } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext'; 
import '../styles/BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, loading } = useAuth(); 

  const navItems = [
    { name: 'Products', path: 'products', icon: <FaBox /> },
    { name: 'Manage', path: 'manage-inventory', icon: <FaExchangeAlt /> },
    { name: 'Sales', path: 'sales', icon: <FaMoneyBillWave /> },
    { name: 'Dashboard', path: 'dashboard', icon: <FaChartBar /> },
  ];

  const path = location.pathname.replace('/', '');
  const currentIndex = navItems.findIndex(item => item.path === (path || 'manage-inventory'));

  if (loading || role === 'staff' || currentIndex === -1) return null;

  return (
    <div className="nav-container">
      <nav className="modern-bottom-nav">
        {/* The Sliding Highlight */}
        <div 
          className="nav-highlight" 
          style={{ 
            transform: `translateX(${currentIndex * 100}%)`,
            width: `${100 / navItems.length}%` 
          }}
        />

        {navItems.map((item) => (
          <div
            key={item.path}
            className={`nav-btn ${path === item.path || (!path && item.path === 'manage-inventory') ? 'active' : ''}`}
            onClick={() => navigate(`/${item.path}`)}
          >
            <div className="nav-icon-container">
              {item.icon}
            </div>
            <span className="nav-text">{item.name}</span>
          </div>
        ))}
      </nav>
    </div>
  );
};

export default BottomNav;