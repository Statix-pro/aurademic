import React from 'react';
import Navbar from '../components/navbar/navbar';
// import ProfileCard from '../userdashboard/profilecard/profilecard';
import ResearchTabs from '../userdashboard/researchtabs/researchtabs';
// import Sidebar from '../userdashboard/sidebar/sidebar';
import './userdashboard.css';

const ResearchPage = () => {
  return (
    <div className="body-mode-dashboard research-page container-fluid">
      <Navbar />
      {/* <ProfileCard /> */}
      <div className="row">
        {/* Sidebar */}
        {/* <div className="col-md-2 sidebar-container">
          <Sidebar />
        </div> */}

        {/* Main Content Area */}
        <div className="col-12 main-content">
          <h5 className="research-details-topics">Research Details</h5>
          <ResearchTabs />
        </div>
      </div>
    </div>
  );
};

export default ResearchPage;
