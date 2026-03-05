import React, { useState, useEffect, useRef } from "react";
import "./navbar.css";
import { Link } from "react-router-dom";

import KSRCTLogo from "../../../assets/images/ksrct_logo.png";
import { useAuth } from "../../../../contexts/AuthContext";
import {
  canAccessAdminArea,
  canAccessBudgetApproval,
  canManageAccessControl,
  isSuperAdmin,
} from "../../../utils/permissionUtils";

const Navbar: React.FC = () => {
  const { logout, user } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navbarRef = useRef<HTMLElement>(null);
  const showAdminDashboard = canAccessAdminArea(user);
  const showBudgetApproval = canAccessBudgetApproval(user);
  const showAccessControl = canManageAccessControl(user);
  const showMasterData = isSuperAdmin(user);
  const showAdminMenu = showAdminDashboard || showBudgetApproval || showAccessControl || showMasterData;

  const toggleDropdown = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const toggleMobileMenu = () => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    setActiveMenu(null);

    if (newState) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setMobileMenuOpen(false);
        document.body.classList.remove('menu-open');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.classList.remove('menu-open');
    };
  }, []);

  return (
    <nav className="navbar" ref={navbarRef}>
      <div className="navbar-left">
        <img
          src={KSRCTLogo}
          alt="KSRCT Logo"
          className="dashboard-logo"
        />
        <span className="college-name">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</span>
      </div>

      <div className="hamburger" onClick={toggleMobileMenu}>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
      </div>

      <div className={`navbar-right ${mobileMenuOpen ? "open" : ""}`}>
        <Link
          to="/publications"
          className="home-icon-link"
          style={{ marginRight: "8px", display: "none" }}
          onClick={() => {
            setMobileMenuOpen(false);
            document.body.classList.remove('menu-open');
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#f7f7f7ff"
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>

        <ul className="nav-menu">
          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${activeMenu === "Research" ? "active" : ""
                }`}
              onClick={() => toggleDropdown("Research")}
            >
              Research
              <svg
                className="arrow-icon"
                width="10"
                height="10"
                viewBox="0 0 451.847 451.847"
              >
                <path d="M225.923,323.861L0,97.938l35.355-35.355l190.568,190.568L416.492,62.583l35.355,35.355L225.923,323.861z" />
              </svg>
            </div>
            <ul
              className={`dropdown ${activeMenu === "Research" ? "show" : ""}`}
            >
              <Link
                to="/publications"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Publication</li>
              </Link>
              <Link
                to="/projects"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Project</li>
              </Link>
              <Link
                to="/fellowship"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Fellowship</li>
              </Link>
              <Link
                to="/patent"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Patent</li>
              </Link>
            </ul>
          </li>
          {/* FINANCE Dropdown */}
          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${activeMenu === "Finance" ? "active" : ""
                }`}
              onClick={() => toggleDropdown("Finance")}
            >
              Finance
              <svg
                className="arrow-icon"
                width="10"
                height="10"
                viewBox="0 0 451.847 451.847"
              >
                <path d="M225.923,323.861L0,97.938l35.355-35.355l190.568,190.568L416.492,62.583l35.355,35.355L225.923,323.861z" />
              </svg>
            </div>
            <ul
              className={`dropdown ${activeMenu === "Finance" ? "show" : ""}`}
            >
              <Link
                to="/financecard"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Finance</li>
              </Link>
              <Link
                to="/budgetcard"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Budget</li>
              </Link>
            </ul>
          </li>




          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${activeMenu === "Bookings" ? "active" : ""
                }`}
              onClick={() => toggleDropdown("Bookings")}
            >
              Bookings
              <svg
                className="arrow-icon"
                width="10"
                height="10"
                viewBox="0 0 451.847 451.847"
              >
                <path d="M225.923,323.861L0,97.938l35.355-35.355l190.568,190.568L416.492,62.583l35.355,35.355L225.923,323.861z" />
              </svg>
            </div>
            <ul
              className={`dropdown ${activeMenu === "Bookings" ? "show" : ""}`}
            >

              <Link
                to="/guestHouse-dashboard"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Guest House</li>
              </Link>

              <Link
                to="/vehicle-booking"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Vehicle</li>
              </Link>
              <Link
                to="/hall-booking"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Hall Booking</li>
              </Link>
              <Link
                to="/eventdashboard"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Event</li>
              </Link>

            </ul>
          </li>

          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${activeMenu === "Profile" ? "active" : ""}`}
              onClick={() => toggleDropdown("Profile")}
            >
              Profile
              <svg
                className="arrow-icon"
                width="10"
                height="10"
                viewBox="0 0 451.847 451.847"
              >
                <path d="M225.923,323.861L0,97.938l35.355-35.355l190.568,190.568L416.492,62.583l35.355,35.355L225.923,323.861z" />
              </svg>
            </div>
            <ul className={`dropdown ${activeMenu === "Profile" ? "show" : ""}`}>
              <Link
                to="/profile"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Profile</li>
              </Link>
              <Link
                to="/kpi"
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>KPI</li>
              </Link>
            </ul>
          </li>
          {showAdminMenu && (
            <li className="nav-item">
              <div
                className={`nav-item-wrapper ${activeMenu === "Admin" ? "active" : ""}`}
                onClick={() => toggleDropdown("Admin")}
              >
                Admin
                <svg
                  className="arrow-icon"
                  width="10"
                  height="10"
                  viewBox="0 0 451.847 451.847"
                >
                  <path d="M225.923,323.861L0,97.938l35.355-35.355l190.568,190.568L416.492,62.583l35.355,35.355L225.923,323.861z" />
                </svg>
              </div>
              <ul className={`dropdown ${activeMenu === "Admin" ? "show" : ""}`}>
                {showAdminDashboard && (
                  <Link
                    to="/admin-dashboard"
                    className="dropdown-li"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      document.body.classList.remove('menu-open');
                    }}
                  >
                    <li>Dashboard</li>
                  </Link>
                )}
                {showBudgetApproval && (
                  <Link
                    to="/admin/budget"
                    className="dropdown-li"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      document.body.classList.remove('menu-open');
                    }}
                  >
                    <li>Budget-Approval</li>
                  </Link>
                )}
                {showAccessControl && (
                  <Link
                    to="/access-control"
                    className="dropdown-li"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      document.body.classList.remove('menu-open');
                    }}
                  >
                    <li>Access Control</li>
                  </Link>
                )}
                {showMasterData && (
                  <Link
                    to="/admin/master-data"
                    className="dropdown-li"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      document.body.classList.remove('menu-open');
                    }}
                  >
                    <li>Master Data</li>
                  </Link>
                )}
              </ul>
            </li>
          )}
          <li className="nav-item">
            <Link
              to="/task"
              className="nav-item-wrapper"
              onClick={() => {
                setMobileMenuOpen(false);
                document.body.classList.remove('menu-open');
              }}
            >
              Task
            </Link>
          </li>
        </ul>

        <button
          className="logout-btn"
          onClick={() => {
            logout();
            setMobileMenuOpen(false);
            document.body.classList.remove('menu-open');
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
