import React, { useState, useRef } from 'react';
import './navbar.css';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, PieChart } from 'lucide-react';

import { useAuth } from '../../../../contexts/AuthContext';
import {
  canAccessAdminArea,
  canAccessBudgetApproval,
  canAccessExpenditureWorkflow,
  canAccessFinanceWorkflow,
  canAccessGuesthouseWorkflow,
  canManageAccessControl,
  hasPermission,
  isSuperAdmin,
} from '../../../utils/permissionUtils';

/* ═══════════════════════════════════════════
   SVG Icon Components (Lucide-style, 24×24)
   ═══════════════════════════════════════════ */

// Dashboard — grid layout
const IconDashboard = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

// Research — open book
const IconResearch = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

// Finance — Indian Rupee sign
const IconFinance = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="M6 3c0 0 2.5 0 4.5 0C13.5 3 16 5 16 8s-2.5 5-5.5 5H6" />
    <path d="M14 21L6 13" />
  </svg>
);

// Reports — pie chart
const IconReports = () => <PieChart className="sb-icon" size={20} strokeWidth={1.8} />;

// Bookings — calendar with clock
const IconBookings = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <circle cx="14" cy="16" r="2" />
    <path d="M14 14v2" />
  </svg>
);

// Directory — users/address book
const IconDirectory = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// Task — clipboard with check
const IconTask = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

// Admin — custom workflow approval
const IconAdmin = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="2" width="6" height="5" rx="1" />
    <line x1="12" y1="7" x2="12" y2="11" />
    <line x1="4" y1="11" x2="20" y2="11" />
    <line x1="4" y1="11" x2="4" y2="15" />
    <line x1="12" y1="11" x2="12" y2="15" />
    <line x1="20" y1="11" x2="20" y2="15" />
    <rect x="1" y="15" width="6" height="5" rx="1" />
    <rect x="9" y="15" width="6" height="5" rx="1" />
    <rect x="17" y="15" width="6" height="5" rx="1" />
  </svg>
);

// Profile — user circle
const IconProfile = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// KPI — bar chart trending up
const IconKpi = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <polyline points="4 10 10 4 14 8 22 2" />
  </svg>
);

// Super Admin — shield with checkmark
const IconSuperAdmin = () => <ShieldCheck className="sb-icon" size={20} strokeWidth={1.8} />;

// Logout — door exit
const IconLogout = () => (
  <svg
    className="sb-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Chevron for dropdowns
const ChevronDown = () => (
  <svg
    className="sb-chevron"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ═══════════════════════════════════════════
   Types & Component
   ═══════════════════════════════════════════ */

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const isExpanded = !collapsed || isHovered;

  const showAdminDashboard = canAccessAdminArea(user);
  const showBudgetApproval = canAccessBudgetApproval(user);
  const showFinanceWorkflow = canAccessFinanceWorkflow(user);
  const showExpenditureWorkflow = canAccessExpenditureWorkflow(user);
  const showGuesthouseApproval = canAccessGuesthouseWorkflow(user);
  const showAccessControl = canManageAccessControl(user);
  const showMasterData = isSuperAdmin(user);
  const showAdminMenu =
    showAdminDashboard ||
    showBudgetApproval ||
    showFinanceWorkflow ||
    showExpenditureWorkflow ||
    showGuesthouseApproval;
  const showSuperAdminMenu = isSuperAdmin(user);

  const toggleDropdown = (menuName: string) => {
    if (collapsed && !isHovered) {
      setCollapsed(false);
      setActiveMenu(menuName);
    } else {
      setActiveMenu((prev) => (prev === menuName ? null : menuName));
    }
  };

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) setCollapsed(true);
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (paths: string[]) =>
    paths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  return (
    <aside
      className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
      ref={sidebarRef}
      onMouseEnter={() => {
        if (collapsed) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (collapsed) {
          setIsHovered(false);
        }
      }}
    >
      {/* ────────────── MAIN NAVIGATION ────────────── */}
      <nav className="sb-nav">
        {/* 1. Dashboard */}
        <Link
          to="/dashboard"
          className={`sb-link ${isActive('/dashboard') ? 'active' : ''}`}
          onClick={handleLinkClick}
          title="Dashboard"
        >
          <IconDashboard />
          <span className="sb-text">Dashboard</span>
        </Link>

        {/* 2. Research */}
        <div className="sb-group">
          <button
            className={`sb-link ${
              isGroupActive(['/publications', '/projects', '/fellowship', '/patent', '/journal'])
                ? 'active'
                : ''
            } ${activeMenu === 'Research' ? 'open' : ''}`}
            onClick={() => toggleDropdown('Research')}
            title="Research"
          >
            <IconResearch />
            <span className="sb-text">Research</span>
            <ChevronDown />
          </button>
          {isExpanded && activeMenu === 'Research' && (
            <div className="sb-submenu">
              <Link
                to="/publications"
                className={`sb-sublink ${isActive('/publications') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Publication
              </Link>
              <Link
                to="/projects"
                className={`sb-sublink ${isActive('/projects') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Project
              </Link>
              <Link
                to="/fellowship"
                className={`sb-sublink ${isActive('/fellowship') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Fellowship
              </Link>
              <Link
                to="/patent"
                className={`sb-sublink ${isActive('/patent') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Patent
              </Link>
            </div>
          )}
        </div>

        {/* 3. Finance */}
        <div className="sb-group">
          <button
            className={`sb-link ${
              isGroupActive([
                '/budgetcard',
                '/financecard',
                '/expenditurecard',
                '/finance',
                '/budget',
              ])
                ? 'active'
                : ''
            } ${activeMenu === 'Finance' ? 'open' : ''}`}
            onClick={() => toggleDropdown('Finance')}
            title="Finance"
          >
            <IconFinance />
            <span className="sb-text">Finance</span>
            <ChevronDown />
          </button>
          {isExpanded && activeMenu === 'Finance' && (
            <div className="sb-submenu">
              <Link
                to="/budgetcard"
                className={`sb-sublink ${isActive('/budgetcard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Budget
              </Link>
              <Link
                to="/financecard"
                className={`sb-sublink ${isActive('/financecard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Application
              </Link>
              <Link
                to="/expenditurecard"
                className={`sb-sublink ${isActive('/expenditurecard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Expenditure
              </Link>
            </div>
          )}
        </div>

        {/* 3.1 Reports */}
        <div className="sb-group">
          <button
            className={`sb-link ${
              isGroupActive(['/admin/budgetdashboard', '/reports']) ? 'active' : ''
            } ${activeMenu === 'Reports' ? 'open' : ''}`}
            onClick={() => toggleDropdown('Reports')}
            title="Reports"
          >
            <IconReports />
            <span className="sb-text">Reports</span>
            <ChevronDown />
          </button>
          {isExpanded && activeMenu === 'Reports' && (
            <div className="sb-submenu">
              <Link
                to="/admin/budgetdashboard"
                className={`sb-sublink ${isActive('/admin/budgetdashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Budget Dashboard
              </Link>
              <Link
                to="/reports/finance"
                className={`sb-sublink ${isActive('/reports/finance') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Finance Dashboard
              </Link>
              <Link
                to="/reports/expenditure"
                className={`sb-sublink ${isActive('/reports/expenditure') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Expenditure Dashboard
              </Link>
            </div>
          )}
        </div>

        {/* 4. Bookings */}
        <div className="sb-group">
          <button
            className={`sb-link ${
              isGroupActive([
                '/guesthouse-dashboard',
                '/vehicle-booking',
                '/hall-booking',
                '/eventdashboard',
                '/event',
                '/workorderdashboard',
                '/workorder',
              ])
                ? 'active'
                : ''
            } ${activeMenu === 'Bookings' ? 'open' : ''}`}
            onClick={() => toggleDropdown('Bookings')}
            title="Bookings"
          >
            <IconBookings />
            <span className="sb-text">Bookings</span>
            <ChevronDown />
          </button>
          {isExpanded && activeMenu === 'Bookings' && (
            <div className="sb-submenu">
              <Link
                to="/guesthouse-dashboard"
                className={`sb-sublink ${isActive('/guesthouse-dashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Guest House
              </Link>
              <Link
                to="/vehicle-booking"
                className={`sb-sublink ${isActive('/vehicle-booking') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Vehicle
              </Link>
              <Link
                to="/hall-booking"
                className={`sb-sublink ${isActive('/hall-booking') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Hall Booking
              </Link>
              <Link
                to="/eventdashboard"
                className={`sb-sublink ${isActive('/eventdashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Event
              </Link>
              <Link
                to="/workorderdashboard"
                className={`sb-sublink ${isActive('/workorderdashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Work Order
              </Link>
            </div>
          )}
        </div>

        {/* Directory */}
        <div className="sb-group">
          <button
            className={`sb-link ${
              isGroupActive([
                '/resourcepersondirectorydashboard',
                '/organizationdirectorydashboard',
              ])
                ? 'active'
                : ''
            } ${activeMenu === 'Directory' ? 'open' : ''}`}
            onClick={() => toggleDropdown('Directory')}
            title="Directory"
          >
            <IconDirectory />
            <span className="sb-text">Directory</span>
            <ChevronDown />
          </button>
          {isExpanded && activeMenu === 'Directory' && (
            <div className="sb-submenu">
              <Link
                to="/resourcepersondirectorydashboard"
                className={`sb-sublink ${isActive('/resourcepersondirectorydashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Resource Person
              </Link>
              <Link
                to="/organizationdirectorydashboard"
                className={`sb-sublink ${isActive('/organizationdirectorydashboard') ? 'active' : ''}`}
                onClick={handleLinkClick}
              >
                Organization
              </Link>
            </div>
          )}
        </div>

        {/* 5. Task */}
        <Link
          to="/task"
          className={`sb-link ${isActive('/task') ? 'active' : ''}`}
          onClick={handleLinkClick}
          title="Task"
        >
          <IconTask />
          <span className="sb-text">Task</span>
        </Link>

        {/* 6. Approvals */}
        {showAdminMenu && (
          <div className="sb-group">
            <button
              className={`sb-link ${
                isGroupActive([
                  '/publication-dashboard',
                  '/project-dashboard',
                  '/admin-dashboard',
                  '/admin/budget',
                  '/admin/guesthouse',
                  '/workflow/finance',
                  '/workflow/expenditure',
                ])
                  ? 'active'
                  : ''
              } ${activeMenu === 'Approvals' ? 'open' : ''}`}
              onClick={() => toggleDropdown('Approvals')}
              title="Approvals"
            >
              <IconAdmin />
              <span className="sb-text">Approvals</span>
              <ChevronDown />
            </button>
            {isExpanded && activeMenu === 'Approvals' && (
              <div className="sb-submenu">
                {showAdminDashboard && (
                  <>
                    <Link
                      to="/publication-dashboard"
                      className={`sb-sublink ${isActive('/publication-dashboard') ? 'active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      Publication Approval
                    </Link>
                    <Link
                      to="/project-dashboard"
                      className={`sb-sublink ${isActive('/project-dashboard') ? 'active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      Project Approval
                    </Link>
                    <Link
                      to="/admin-dashboard"
                      className={`sb-sublink ${isActive('/admin-dashboard') ? 'active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      Dashboard
                    </Link>
                  </>
                )}
                {showBudgetApproval && (
                  <Link
                    to="/admin/budget"
                    className={`sb-sublink ${isActive('/admin/budget') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Budget Approval
                  </Link>
                )}
                {showFinanceWorkflow && (
                  <Link
                    to="/workflow/finance"
                    className={`sb-sublink ${isActive('/workflow/finance') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Finance Approval
                  </Link>
                )}
                {showExpenditureWorkflow && (
                  <Link
                    to="/workflow/expenditure"
                    className={`sb-sublink ${isActive('/workflow/expenditure') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Expenditure Approval
                  </Link>
                )}
                {showGuesthouseApproval && (
                  <Link
                    to="/admin/guesthouse"
                    className={`sb-sublink ${isActive('/admin/guesthouse') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Guesthouse Approval
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* 7. Super Admin */}
        {showSuperAdminMenu && (
          <div className="sb-group">
            <button
              className={`sb-link ${
                isGroupActive(['/access-control', '/admin/master-data', '/admin/budget-catalog'])
                  ? 'active'
                  : ''
              } ${activeMenu === 'SuperAdmin' ? 'open' : ''}`}
              onClick={() => toggleDropdown('SuperAdmin')}
              title="Super Admin"
            >
              <IconSuperAdmin />
              <span className="sb-text">Super Admin</span>
              <ChevronDown />
            </button>
            {isExpanded && activeMenu === 'SuperAdmin' && (
              <div className="sb-submenu">
                {showAccessControl && (
                  <Link
                    to="/access-control"
                    className={`sb-sublink ${isActive('/access-control') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Access Control
                  </Link>
                )}
                {showMasterData && (
                  <Link
                    to="/admin/master-data"
                    className={`sb-sublink ${isActive('/admin/master-data') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Master Data
                  </Link>
                )}
                {showMasterData && (
                  <Link
                    to="/admin/budget-catalog"
                    className={`sb-sublink ${isActive('/admin/budget-catalog') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    Budget Catalog
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ────────────── PROFILE FOOTER ────────────── */}
      <div className="sb-profile">
        <div className="sb-divider" />

        <Link
          to="/profile"
          className={`sb-link ${isActive('/profile') ? 'active' : ''}`}
          onClick={handleLinkClick}
          title="My Profile"
        >
          <IconProfile />
          <span className="sb-text">My Profile</span>
        </Link>

        <Link
          to="/kpi"
          className={`sb-link ${isActive('/kpi') ? 'active' : ''}`}
          onClick={handleLinkClick}
          title="KPI"
        >
          <IconKpi />
          <span className="sb-text">KPI</span>
        </Link>

        <button
          className="sb-link sb-logout-link"
          onClick={() => setShowLogoutConfirm(true)}
          title="Logout"
        >
          <IconLogout />
          <span className="sb-text">Logout</span>
        </button>
      </div>

      {/* ────────────── LOGOUT CONFIRM MODAL ────────────── */}
      {showLogoutConfirm && (
        <div className="sb-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sb-modal-icon">
              <IconLogout />
            </div>
            <h3 className="sb-modal-title">Logout</h3>
            <p className="sb-modal-msg">Are you sure you want to logout?</p>
            <div className="sb-modal-actions">
              <button className="sb-modal-cancel" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="sb-modal-ok" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
