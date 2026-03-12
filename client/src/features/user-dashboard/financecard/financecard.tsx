// client/src/features/user-dashboard/financecard/financecard.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './financecard.css';
import { Eye, Edit2, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface FinanceCardItem {
  id: number;
  applicant_name: string;
  beneficiary_type: string;
  primary_head: string;
  amount: number;
  overall_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const FinanceCard: React.FC = () => {
  const [data, setData] = useState<FinanceCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/finance-dashboard', {
        withCredentials: true,
      });
      setData(res.data.data || []);
    } catch (err) {
      console.error('Finance dashboard error', err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    return `financecard-status financecard-status--${status}`;
  };

  return (
    <>


      <section className="financecard-page">
        {/* HEADER */}
        <div className="financecard-header">
          <h5 className="financecard-title">Finance Requests</h5>

          <button
            className="financecard-add-btn"
            onClick={() => navigate('/finance/new')}
          >
            <Plus size={14} /> Add +
          </button>
        </div>

        {/* CONTENT */}
        <div className="financecard-wrapper">
          {loading && (
            <div className="financecard-state">Loading finance requests...</div>
          )}

          {!loading && data.length === 0 && (
            <div className="financecard-state">
              No finance requests found
            </div>
          )}

          {!loading &&
            data.map((item) => (
              <div className="financecard-item" key={item.id}>
                <div className="financecard-row">
                  <div className="financecard-left">
                    <h6 className="financecard-name">
                      {item.applicant_name}
                    </h6>

                    <p className="financecard-meta">
                      <span className="financecard-tag">
                        {item.beneficiary_type}
                      </span>
                      <span className="financecard-primary">
                        {item.primary_head}
                      </span>
                    </p>

                    <p className="financecard-amount">
                      Amount : ₹ {Number(item.amount || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="financecard-right">
                    <span className={statusBadge(item.overall_status)}>
                      {item.overall_status}
                    </span>

                    <div className="financecard-actions">
                      <button
                        title="View"
                        onClick={() =>
                          navigate(`/finance/view/${item.id}`)
                        }
                      >
                        <Eye size={14} />
                      </button>

                      <button
                        title="Edit"
                        onClick={() =>
                          navigate(`/finance/edit/${item.id}`)
                        }
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        title="Delete"
                        className="danger"
                        onClick={() =>
                          navigate(`/finance/delete/${item.id}`)
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="financecard-date">
                      Submitted:{' '}
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>
    </>
  );
};

export default FinanceCard;
