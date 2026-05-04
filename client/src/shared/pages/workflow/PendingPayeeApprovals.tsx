import React from 'react';
import { CheckCircle2, XCircle, CreditCard } from 'lucide-react';

interface PendingPayeeApprovalsProps {
  pendingPayees: any[];
  pendingPayeesLoading: boolean;
  onPayeeDecision: (id: number, decision: 'approved' | 'rejected') => void;
  pendingPayeeActingId: number | null;
}

const PendingPayeeApprovals: React.FC<PendingPayeeApprovalsProps> = ({
  pendingPayees,
  pendingPayeesLoading,
  onPayeeDecision,
  pendingPayeeActingId,
}) => {
  if (pendingPayeesLoading) {
    return <div className="fw-state" style={{ padding: '2rem 0' }}>Loading pending payees...</div>;
  }

  if (pendingPayees.length === 0) {
    return (
      <div className="fw-state" style={{ padding: '4rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b' }}>
        <CreditCard size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <h4 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>No pending payees</h4>
        <p style={{ margin: '0.5rem 0 0' }}>There are no payees waiting for approval at this time.</p>
      </div>
    );
  }

  return (
    <div className="fw-payee-list" style={{ display: 'grid', gap: '16px', padding: '10px 0' }}>
      {pendingPayees.map((payee) => {
        const payeeName = String(payee.payee_name || payee.account_name || '').trim() || 'Unnamed payee';
        const busy = pendingPayeeActingId === Number(payee.id);

        return (
          <div
            key={`pending-payee-${payee.id}`}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                flexShrink: 0
              }}>
                <CreditCard size={24} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1.05rem', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {payeeName}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                    {payee.bank_name || 'No Bank'}
                  </span>
                  <span>A/C: <strong style={{ color: '#475569' }}>{payee.account_no || '-'}</strong></span>
                  <span>IFSC: <strong style={{ color: '#475569' }}>{String(payee.ifsc || '').toUpperCase() || '-'}</strong></span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPayeeDecision(Number(payee.id), 'approved')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', 
                  border: '1px solid #16a34a', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, 
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, transition: 'all 0.2s ease',
                  width: 'auto', height: 'auto'
                }}
              >
                <CheckCircle2 size={18} /> Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onPayeeDecision(Number(payee.id), 'rejected')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', 
                  border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', fontWeight: 600, 
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, transition: 'all 0.2s ease',
                  width: 'auto', height: 'auto'
                }}
              >
                <XCircle size={18} /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingPayeeApprovals;
