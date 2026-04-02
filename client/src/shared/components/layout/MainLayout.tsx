import { useState } from 'react';
import Sidebar from './navbar/navbar';
import { Outlet } from 'react-router-dom';
import KSRCTLogo from '../../assets/images/ksrct_logo.png';
import './MainLayout.css';

const MainLayout = () => {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="app-layout">
            {/* Top Bar */}
            <header className="topbar">
                <div className="topbar-left">
                    <button className="topbar-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                    </button>
                    <img src={KSRCTLogo} alt="KSRCT" className="topbar-logo" />
                    <span className="topbar-title">K.S.RANGASAMY COLLEGE OF TECHNOLOGY</span>
                </div>
            </header>

            {/* Sidebar */}
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

            {/* Overlay backdrop */}
            <div
                className={`sidebar-overlay ${!collapsed ? 'visible' : ''}`}
                onClick={() => setCollapsed(true)}
            />

            {/* Main Content */}
            <main className="app-content">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
