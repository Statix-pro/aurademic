import React from 'react';
import './profilecard.css';
import { useAuth } from '../../../contexts/AuthContext';

const ProfileCard: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="profile-card bg-light rounded">
      <div className="row align-items-center">
        <div className="col-md-3 text-center">
          <p className="name mt-2">{user?.name} </p>
          <p className="role">Assistant Professor</p>
        </div>

        <div className="col-md-9">
          <div className="info">
            <div className="row">
              <div className="col-6">
                <h6 className="employee-id">EMPLOYEE ID: KSRMECH56</h6>
                <p className="department">Department of Mechanical Engineering</p>
              </div>
              <div className="col-6">
                <h6>RESEARCH AREA: </h6>
                <p className="research-area">LIGNOCELLULOSE FIBERS, CHARACTERIZATION, COMPOSITES</p>
              </div>
            </div>

            <div className="action-buttons">
              <button className="btn">Google Scholar</button>
              <button className="btn">Scopus</button>
              <button className="btn">Researcher ID</button>
              <button className="btn">Orcid ID</button>
              <button className="btn">Extract Profile</button>
            </div>
            <div className="stats mt-4">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-center stat-title" style={{ marginBottom: '20px' }}>Academic year (2023-2024)</h6>
                  <div className="row g-0 text-center">
                    <div className="col"><h6>Publications</h6><p>8</p></div>
                    <div className="col"><h6>Patents</h6><p>17</p></div>
                    <div className="col"><h6>Projects</h6><p>13</p></div>
                    <div className="col"><h6>Acad. Guidance</h6><p>90</p></div>
                  </div>
                </div>
                <div className="col-md-6">
                  <h6 className="text-center stat-title" style={{ marginBottom: '20px' }}>Overall Status</h6>
                  <div className="row g-0 text-center">
                    <div className="col"><h6>Publications</h6><p>8</p></div>
                    <div className="col"><h6>Patents</h6><p>17</p></div>
                    <div className="col"><h6>Projects</h6><p>13</p></div>
                    <div className="col"><h6>Acad. Guidance</h6><p>90</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
