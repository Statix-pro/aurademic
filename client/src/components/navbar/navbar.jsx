import React, { useState, useEffect, useRef } from "react";
import "./navbar.css";
import { Link, useNavigate } from "react-router-dom";
import KSRCTLogo from "../images/ksrct_logo.png";
import { useAuth } from "../../context/AuthContext";

const Navbar = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navbarRef = useRef(null);

  const toggleDropdown = (menuName) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const toggleMobileMenu = () => {
    const newState = !mobileMenuOpen;
    setMobileMenuOpen(newState);
    setActiveMenu(null);
    
    // Add/remove body class to prevent scrolling when menu is open
    if (newState) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
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
      {/* Left Section */}
      <div className="navbar-left">
        <img
          src={KSRCTLogo}
          alt="KSRCT Logo"
          className="dashboard-logo"
        />
        <span className="college-name">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</span>
      </div>

      {/* Hamburger Icon */}
      <div className="hamburger" onClick={toggleMobileMenu}>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
        <div className={`bar ${mobileMenuOpen ? "open" : ""}`}></div>
      </div>

      {/* Right Section */}
      <div className={`navbar-right ${mobileMenuOpen ? "open" : ""}`}>
        <Link
          to="/publications"
          className="home-icon-link"
          style={{ marginRight: "8px" }}
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
          {/* Research Dropdown */}
          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${
                activeMenu === "Research" ? "active" : ""
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
              <li>Fellowship</li>
              <li>Patent</li>
            </ul>
          </li>

          {/* Bookings Dropdown */}
          <li className="nav-item">
            <div
              className={`nav-item-wrapper ${
                activeMenu === "Bookings" ? "active" : ""
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
                to="/eventdashboard" 
                className="dropdown-li"
                onClick={() => {
                  setMobileMenuOpen(false);
                  document.body.classList.remove('menu-open');
                }}
              >
                <li>Event</li>
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
            </ul>
          </li>

          {/* Other Menus */}
          <li className="nav-item">
            <Link 
              to="/profile" 
              className="nav-item-wrapper"
              onClick={() => {
                setMobileMenuOpen(false);
                document.body.classList.remove('menu-open');
              }}
            >
              Profile
            </Link>
          </li>
          <li className="nav-item">
            <Link 
              to="/kpi" 
              className="nav-item-wrapper"
              onClick={() => {
                setMobileMenuOpen(false);
                document.body.classList.remove('menu-open');
              }}
            >
              KPI
            </Link>
          </li>
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
          <li className="nav-item">
            <Link 
              to="/reports" 
              className="nav-item-wrapper"
              onClick={() => {
                setMobileMenuOpen(false);
                document.body.classList.remove('menu-open');
              }}
            >
              Reports
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

