import { Bell, User } from 'lucide-react';
import React, { useState } from 'react';
import { Nav } from 'react-bootstrap';

import NotificationPreferencesPanel from '../../shared/notifications/NotificationPreferences';
import ProfileCard from '../user-dashboard/profilecard/profilecard';

type ProfileTab = 'profile' | 'notifications';

const ProfilePage: React.FC = () => {
  // Local state rather than a route param: the two panels are settings for the
  // same page, and a deep link to a settings tab is not something anything
  // links to.
  const [tab, setTab] = useState<ProfileTab>('profile');

  return (
    <div
      className="profile-page"
      style={{ minHeight: '100vh', backgroundColor: 'var(--bg-light, #f0f6ff)' }}
    >
      <div className="container py-4">
        <div className="d-flex align-items-center gap-3 mb-4 mt-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, var(--primary-color, #0069ab) 0%, #00a8e8 100%)',
              boxShadow: '0 4px 15px rgba(0, 105, 171, 0.3)',
            }}
          >
            {tab === 'notifications' ? (
              <Bell size={24} color="white" />
            ) : (
              <User size={24} color="white" />
            )}
          </div>
          <div>
            <h2 className="mb-0" style={{ color: 'var(--text-main, #4f4f6e)', fontWeight: 600 }}>
              {tab === 'notifications' ? 'Notification settings' : 'My Profile'}
            </h2>
            <small style={{ color: 'var(--text-muted, #6c757d)' }}>
              {tab === 'notifications'
                ? 'Choose what you are told about, and where'
                : 'View and manage your profile information'}
            </small>
          </div>
        </div>

        <Nav variant="tabs" activeKey={tab} className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="profile" onClick={() => setTab('profile')}>
              Profile
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="notifications" onClick={() => setTab('notifications')}>
              Notifications
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {tab === 'profile' ? <ProfileCard /> : <NotificationPreferencesPanel />}
      </div>
    </div>
  );
};

export default ProfilePage;
