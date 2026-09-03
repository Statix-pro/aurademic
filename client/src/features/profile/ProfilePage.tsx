import { Bell, User } from 'lucide-react';
import React from 'react';
import { Nav } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';

import NotificationPreferencesPanel from '../../shared/notifications/NotificationPreferences';
import { PROFILE_NOTIFICATIONS_TAB, PROFILE_TAB_PARAM } from '../../shared/notifications/routes';
import ProfileCard from '../user-dashboard/profilecard/profilecard';

type ProfileTab = 'profile' | 'notifications';

const ProfilePage: React.FC = () => {
  /**
   * The tab lives in the query string, not in component state: the inbox and
   * the bell both link straight to the notification settings, and with local
   * state those links would open the profile tab instead. `replace` keeps the
   * back button pointing at wherever the user came from rather than at the
   * other tab.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ProfileTab =
    searchParams.get(PROFILE_TAB_PARAM) === PROFILE_NOTIFICATIONS_TAB ? 'notifications' : 'profile';

  const setTab = (next: ProfileTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'notifications') params.set(PROFILE_TAB_PARAM, PROFILE_NOTIFICATIONS_TAB);
    else params.delete(PROFILE_TAB_PARAM);
    setSearchParams(params, { replace: true });
  };

  return (
    <div
      className="profile-page"
      style={{ minHeight: '100vh', backgroundColor: 'var(--bg-light, #f0f6ff)' }}
    >
      <div className="container-fluid px-4 py-4">
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
