import React from 'react';
import { Tabs, Tab } from 'react-bootstrap';
import './researchtabs.css';

const ResearchTabs: React.FC = () => {
  return (
    <div className="research-tab-overall-class">
      <div className="research-tabs">
        <Tabs defaultActiveKey="events" id="research-tabs" className="mb-4">
          <Tab eventKey="events" title="Events">
            <p>Events content goes here</p>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
};

export default ResearchTabs;
