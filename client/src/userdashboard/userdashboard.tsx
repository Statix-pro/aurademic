import React from 'react';
import Navbar from '../components/navbar/navbar';
import ResearchTabs from './researchtabs/researchtabs';

const ResearchPage: React.FC = () => {
  return (
    <div className="research-page">
      <Navbar />
      <div>
        <ResearchTabs />
      </div>
    </div>
  );
};

export default ResearchPage;
