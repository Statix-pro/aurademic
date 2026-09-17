import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import CustomButton from './CustomButton';
import './NotFound.css';

/**
 * The catch-all for a path no route matches.
 *
 * `App.tsx` had no `path="*"` at all, so an unknown, mistyped or retired URL
 * rendered an empty document — no shell, no navigation, nothing to say what had
 * happened. This route lives inside `MainLayout`, so the sidebar and top bar
 * stay put and the address is a wrong turn rather than a dead end.
 */
const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">We couldn&apos;t find that page</h1>
        <p className="not-found-message">
          The link may be out of date, or the address may have been typed slightly wrong.
        </p>

        <div className="not-found-path">{location.pathname}</div>

        <div className="not-found-actions">
          {/* Back first: an unknown path is usually one click off something the
              person meant, and the dashboard is the fallback when it is not. */}
          <CustomButton variant="light" onClick={() => navigate(-1)}>
            Go back
          </CustomButton>
          <CustomButton onClick={() => navigate('/dashboard')}>Go to dashboard</CustomButton>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
