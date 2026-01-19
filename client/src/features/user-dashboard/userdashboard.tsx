import React from 'react';
import Navbar from '../../shared/components/layout/navbar/navbar';
import ProfileCard from './profilecard/profilecard';

const ResearchPage: React.FC = () => {
  return (
    <div className="research-page">
      <Navbar />
      <div>
        <ProfileCard />
      </div>
    </div>
  );
};

export default ResearchPage;
