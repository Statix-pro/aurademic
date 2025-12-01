import React from 'react';
import './sidebar.css';

const Sidebar = () => {
  return (
    <div className="sidebar bg-light p-3">
      <ul className="nav flex-column">
        <li className="nav-item">
          <a href="./" className="nav-link">
            Publications
          </a>
        </li>
        <li className="nav-item">
          <a href="./" className="nav-link">
            Patents
          </a>
        </li>
        <li className="nav-item">
          <a href="./" className="nav-link">
            Projects
          </a>
        </li>
        <li className="nav-item">
          <a href="./" className="nav-link">
            Collaborations
          </a>
        </li>
        <li className="nav-item">
          <a href="./" className="nav-link">
            Guideship
          </a>
        </li>
        <li className="nav-item">
          <a href="./" className="nav-link">
            Editorship
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
