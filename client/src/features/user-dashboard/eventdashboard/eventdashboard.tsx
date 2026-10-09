// client/src/features/user-dashboard/eventdashboard/eventdashboard.tsx
import React from 'react';

import { EventDashboard as BaseEventDashboard } from '../../events/events';
import './eventdashboard.css';

const EventDashboard: React.FC = () => {
  return (
    <div className="user-event-dashboard-container">
      <BaseEventDashboard />
    </div>
  );
};

export default EventDashboard;
export { EventDashboard };
