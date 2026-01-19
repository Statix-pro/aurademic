import React, { useEffect, useState } from 'react';
import './profilecard.css';
import authenticityUtility from '../../../shared/utils/authenticityUtility';

interface DashboardStats {
  project_count: number;
  publication_count: number;
  collaboration_count: number;
}

interface UserProfile {
  user_id: number;
  name: string;
  email: string;
  department: string;
  designation: string;
  profile_image: string | null;
  employee_id?: string;
  orcid_id?: string;
  scopus_id?: string;
  google_scholar_id?: string;
  researcher_id?: string;
  research_area?: string;
}

const ProfileCard: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileRes, statsRes] = await Promise.all([
          authenticityUtility.get('/dashboard/profile'),
          authenticityUtility.get('/dashboard/stats'),
        ]);

        if ((profileRes as any).success) {
          setProfile((profileRes as any).data);
        }
        if ((statsRes as any).success) {
          setStats((statsRes as any).data);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Loading profile...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-danger">{error}</div>;
  }

  return (
    <div className="profile-card bg-light rounded">
      <div className="row align-items-center">
        <div className="col-md-3 text-center">
          {profile?.profile_image ? (
            <img
              src={profile.profile_image}
              alt={profile.name}
              className="rounded-circle mb-2"
              style={{ width: '120px', height: '120px', objectFit: 'cover' }}
            />
          ) : (
            <div className="avatar-placeholder rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center bg-secondary text-white" style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
              {profile?.name?.charAt(0) || 'U'}
            </div>
          )}
          <p className="name mt-2">{profile?.name || 'Not Available'}</p>
          <p className="role">{profile?.designation || 'Not Available'}</p>
        </div>

        <div className="col-md-9">
          <div className="info">
            <div className="row">
              <div className="col-6">
                <h6 className="employee-id">EMPLOYEE ID: {profile?.employee_id || 'Not Available'}</h6>
                <p className="department">{profile?.department || 'Not Available'}</p>
              </div>
              <div className="col-6">
                <h6>RESEARCH AREA: </h6>
                <p className="research-area">{profile?.research_area || 'Not Available'}</p>
              </div>
            </div>

            <div className="row mt-3">
              <div className="col-4">
                <h6>SCOPUS ID: </h6>
                <p className="text-secondary">{profile?.scopus_id || 'Not Available'}</p>
              </div>
              <div className="col-4">
                <h6>RESEARCHER ID: </h6>
                <p className="text-secondary">{profile?.researcher_id || 'Not Available'}</p>
              </div>
              <div className="col-4">
                <h6>GOOGLE SCHOLAR ID: </h6>
                <p className="text-secondary">{profile?.google_scholar_id || 'Not Available'}</p>
              </div>
            </div>

            {!profile?.employee_id && (
              <div className="alert alert-info mt-3" role="alert">
                <small>Your profile is not linked to employee records. Please contact the administrator to update your details.</small>
              </div>
            )}

            <div className="action-buttons my-3">
              {profile?.google_scholar_id && (
                <a href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`} target="_blank" rel="noopener noreferrer" className="btn me-2">Google Scholar</a>
              )}
              {profile?.scopus_id && (
                <a href={`https://www.scopus.com/authid/detail.uri?authorId=${profile.scopus_id}`} target="_blank" rel="noopener noreferrer" className="btn me-2">Scopus</a>
              )}
              {profile?.researcher_id && (
                <a href={`https://www.webofscience.com/wos/author/record/${profile.researcher_id}`} target="_blank" rel="noopener noreferrer" className="btn me-2">Researcher ID</a>
              )}
              {profile?.orcid_id && (
                <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener noreferrer" className="btn me-2">ORCID</a>
              )}
            </div>

            <div className="stats mt-4">
              <div className="row">
                <div className="col-md-12">
                  <h6 className="text-center stat-title" style={{ marginBottom: '20px' }}>Overall Status</h6>
                  <div className="row g-0 text-center">
                    <div className="col"><h6>Publications</h6><p>{stats?.publication_count || 0}</p></div>
                    <div className="col"><h6>Projects</h6><p>{stats?.project_count || 0}</p></div>
                    <div className="col"><h6>Collaborations</h6><p>{stats?.collaboration_count || 0}</p></div>
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
