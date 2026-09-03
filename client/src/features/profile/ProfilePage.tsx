import { User } from 'lucide-react';
import React from 'react';

import ProfileCard from '../user-dashboard/profilecard/profilecard';

const ProfilePage: React.FC = () => {
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
            <User size={24} color="white" />
          </div>
          <div>
            <h2 className="mb-0" style={{ color: 'var(--text-main, #4f4f6e)', fontWeight: 600 }}>
              My Profile
            </h2>
            <small style={{ color: 'var(--text-muted, #6c757d)' }}>
              View and manage your profile information
            </small>
          </div>
        </div>
        <ProfileCard />
      </div>
    </div>
  );
};

export default ProfilePage;
