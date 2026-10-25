import { ExternalLink } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

import AlertModal from '../../shared/components/ui/AlertModal';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomCard from '../../shared/components/ui/CustomCard';
import { useToast } from '../../shared/components/ui/toast/ToastProvider';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import './scopusProfiles.css';

interface SamplePaper {
  title: string;
  year: string | null;
  source: string;
}

interface Suggestion {
  scopusAuthorId: string;
  names: string[];
  papers: number;
  samples: SamplePaper[];
}

interface ProfilesResponse {
  staff: { name: string; erpId: string } | null;
  yours: { scopusAuthorId: string; papers: number }[];
  suggestions: Suggestion[];
}

const scopusLink = (id: string) => `https://www.scopus.com/authid/detail.uri?authorId=${id}`;

const errorText = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/**
 * My Profile → Scopus profiles. KSRCT's papers are loaded from its Scopus export and credited
 * by Scopus Author ID. Scopus often gives one person more than one profile, so the profiles
 * that look like this staff member's — by name, on KSRCT papers nobody has been credited for —
 * are offered here, and confirming one credits its papers to them at once.
 */
const ScopusProfiles: React.FC = () => {
  const toast = useToast();
  const [data, setData] = useState<ProfilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<Suggestion | null>(null);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = (await authenticityUtility.get('/scopus-profile')) as {
        data?: ProfilesResponse;
      };
      setData(response.data ?? null);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Your Scopus profiles could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (suggestion: Suggestion) => {
    setConfirming(null);
    setClaiming(true);
    try {
      const response = (await authenticityUtility.post('/scopus-profile/claims', {
        scopusAuthorId: suggestion.scopusAuthorId,
      })) as { data?: { papers: number } };
      const papers = response.data?.papers ?? 0;
      toast.success(
        `Scopus profile added — ${papers} ${papers === 1 ? 'paper is' : 'papers are'} now credited to you`,
      );
      await load();
    } catch (err) {
      toast.error(errorText(err, 'The Scopus profile could not be added.'));
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <div className="scopus-profiles__empty">Loading…</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data?.staff) {
    return (
      <Alert variant="info">
        Your login is not linked to a staff record, so there are no Scopus profiles to show.
      </Alert>
    );
  }

  return (
    <div className="scopus-profiles">
      <CustomCard className="scopus-profiles__card">
        <h3 className="scopus-profiles__section-title">Your Scopus Author IDs</h3>
        <p className="scopus-profiles__help">
          Papers in KSRCT&apos;s Scopus export are added to the portal and credited to you through
          these IDs.
        </p>
        {data.yours.length > 0 ? (
          <ul className="scopus-profiles__ids">
            {data.yours.map((entry) => (
              <li key={entry.scopusAuthorId} className="scopus-profiles__id">
                <a
                  href={scopusLink(entry.scopusAuthorId)}
                  target="_blank"
                  rel="noreferrer"
                  className="scopus-profiles__id-link"
                >
                  {entry.scopusAuthorId}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
                <span className="scopus-profiles__meta">
                  {entry.papers} {entry.papers === 1 ? 'paper' : 'papers'} credited
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="scopus-profiles__meta">No Scopus Author ID is on your record yet.</p>
        )}
      </CustomCard>

      <CustomCard className="scopus-profiles__card">
        <h3 className="scopus-profiles__section-title">Profiles that may be yours</h3>
        <p className="scopus-profiles__help">
          These Scopus profiles have KSRCT papers credited to nobody, under a name like yours.
          Confirm only the ones that are you: their papers are credited to you straight away, and
          the research office can see who confirmed what.
        </p>
        {data.suggestions.length === 0 ? (
          <p className="scopus-profiles__meta">
            No other Scopus profile looks like yours. If one is missing, ask the research office to
            add its Scopus Author ID to your record.
          </p>
        ) : (
          <div className="scopus-profiles__suggestions">
            {data.suggestions.map((suggestion) => (
              <section key={suggestion.scopusAuthorId} className="scopus-profiles__suggestion">
                <div className="scopus-profiles__suggestion-head">
                  <div>
                    <span className="scopus-profiles__name">{suggestion.names.join(' · ')}</span>
                    <span className="scopus-profiles__meta">
                      Scopus ID{' '}
                      <a
                        href={scopusLink(suggestion.scopusAuthorId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {suggestion.scopusAuthorId}
                      </a>{' '}
                      · {suggestion.papers} KSRCT {suggestion.papers === 1 ? 'paper' : 'papers'}
                    </span>
                  </div>
                  <CustomButton
                    size="sm"
                    onClick={() => setConfirming(suggestion)}
                    disabled={claiming}
                  >
                    This is me
                  </CustomButton>
                </div>
                <ul className="scopus-profiles__papers">
                  {suggestion.samples.map((paper) => (
                    <li key={`${paper.title}-${paper.year}`}>
                      <span className="scopus-profiles__paper-title">{paper.title}</span>
                      <span className="scopus-profiles__meta">
                        {[paper.source, paper.year].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CustomCard>

      <AlertModal
        show={confirming !== null}
        onHide={() => setConfirming(null)}
        type="info"
        title="Is this your Scopus profile?"
        message={
          confirming
            ? `Scopus ID ${confirming.scopusAuthorId} will be added to your record and its ${confirming.papers} KSRCT ${confirming.papers === 1 ? 'paper' : 'papers'} credited to you. The research office can see and undo this.`
            : ''
        }
        showCancel
        confirmText="Yes, this is me"
        onConfirm={() => confirming && claim(confirming)}
      />
    </div>
  );
};

export default ScopusProfiles;
