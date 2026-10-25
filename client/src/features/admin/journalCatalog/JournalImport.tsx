import { Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';

import ImportBatchView from './ImportBatchView';
import ImportHistory from './ImportHistory';
import { errorMessage } from './importLabels';
import JournalList from './JournalList';
import { prepareUpload } from './prepareUpload';
import CustomButton from '../../../shared/components/ui/CustomButton';
import CustomDropdown, { OptionType } from '../../../shared/components/ui/CustomDropdown';
import CustomFileUploader from '../../../shared/components/ui/CustomFileUploader';
import CustomInput from '../../../shared/components/ui/CustomInput';
import authenticityUtility from '../../../shared/utils/authenticityUtility';
import { AdminScreenHeader, AdminTabs } from '../components/AdminScreen';

import type { ApiEnvelope, ImportBatch, ImportSource, SourcesResponse } from './types';
import './journalImport.css';

type TabKey = 'import' | 'history' | 'journals';

type Stage = 'idle' | 'preparing' | 'uploading';

const STAGE_TEXT: Record<Exclude<Stage, 'idle'>, string> = {
  preparing: 'Reading the file on this computer…',
  uploading: 'Checking every journal against the list…',
};

/**
 * Super Admin → Journal Import. Fills the KSRCT journal list from files the college already
 * has — the faculty journal sheet, KSRCT's Scopus and Web of Science exports, and the yearly
 * Scopus Source List and SCImago ranking — instead of journals being typed in one at a time.
 * Each file is previewed first; nothing changes until it is applied.
 *
 * A data-maintenance tool, kept out of the approval screens: the route and every endpoint
 * behind it are super-admin only.
 */
const JournalImport: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('import');
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [exclusionReasons, setExclusionReasons] = useState<Record<string, string>>({});
  const [sourceKey, setSourceKey] = useState<string>('');
  const [metricYear, setMetricYear] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [historyBatchId, setHistoryBatchId] = useState<number | null>(null);

  useEffect(() => {
    authenticityUtility
      .get('/journal-catalog/sources')
      .then((response) => {
        const data = (response as unknown as ApiEnvelope<SourcesResponse>).data;
        setSources(data?.sources ?? []);
        setExclusionReasons(data?.exclusionReasons ?? {});
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load the import sources.')));
  }, []);

  const source = sources.find((item) => item.key === sourceKey) ?? null;
  const sourceOptions: OptionType[] = sources.map((item) => ({
    value: item.key,
    label: item.label,
  }));

  const resetUpload = () => {
    setPreviewId(null);
    setFile(null);
    setError('');
  };

  const readFile = async () => {
    if (!source || !file) return;
    if (source.needsMetricYear && !/^\d{4}$/.test(metricYear.trim())) {
      setError('Enter the year the Impact Factor and CiteScore values belong to, e.g. 2024.');
      return;
    }
    setError('');
    try {
      setStage('preparing');
      const prepared = await prepareUpload(file, source);

      setStage('uploading');
      const formData = new FormData();
      formData.append('file', prepared.blob, prepared.fileName);
      if (source.needsMetricYear) formData.append('metricYear', metricYear.trim());
      const response = (await authenticityUtility.postFile(
        `/journal-catalog/imports/${source.key}/preview`,
        formData,
      )) as ApiEnvelope<ImportBatch>;

      setPreviewId(response.data?.id ?? null);
    } catch (err) {
      setError(errorMessage(err, 'The file could not be read.'));
    } finally {
      setStage('idle');
    }
  };

  const busy = stage !== 'idle';
  const accept = source
    ? [...source.fileTypes, ...(source.fileTypes.includes('.csv') ? ['.csv.gz'] : [])].join(',')
    : undefined;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'import', label: 'Import a file' },
    { key: 'history', label: 'Import history' },
    { key: 'journals', label: 'Journal list' },
  ];

  return (
    <div className="admin-screen journal-import">
      <AdminScreenHeader
        title="Journal Import"
        description="Developer tool: loads the KSRCT journal list from the faculty journal sheet, KSRCT's Scopus and Web of Science exports, and the yearly Scopus Source List and SCImago ranking."
      />

      <AdminTabs<TabKey>
        tabs={tabs}
        active={tab}
        onChange={(key) => {
          setTab(key);
          setHistoryBatchId(null);
        }}
      />

      {tab === 'import' &&
        (previewId ? (
          <>
            <ImportBatchView
              batchId={previewId}
              sources={sources}
              exclusionReasons={exclusionReasons}
            />
            <div className="journal-import__again">
              <CustomButton variant="light" className="admin-btn-secondary" onClick={resetUpload}>
                Import another file
              </CustomButton>
            </div>
          </>
        ) : (
          <div className="journal-import__panel">
            <h2 className="journal-import__section-title">Import a file</h2>
            <p className="journal-import__meta">
              Upload the KSRCT Scopus and Web of Science exports before the Scopus Source List and
              SCImago file, so journals the exports add also get their Scopus status and quartile. A
              file can be imported again at any time; anything already right stays as it is.
            </p>

            <div className="journal-import__form">
              <CustomDropdown
                name="importSource"
                label="File"
                placeholder="Choose what you are uploading"
                options={sourceOptions}
                value={sourceOptions.find((option) => option.value === sourceKey) ?? null}
                onChange={(option) => {
                  setSourceKey(String((option as OptionType)?.value ?? ''));
                  setFile(null);
                  setError('');
                }}
                isDisabled={busy}
              />
              {source?.needsMetricYear && (
                <CustomInput
                  name="metricYear"
                  label="Metrics year"
                  placeholder="e.g. 2024"
                  value={metricYear}
                  onChange={setMetricYear}
                  disabled={busy}
                  required
                />
              )}
            </div>

            {source && (
              <>
                <p className="journal-import__help">{source.description}</p>
                <CustomFileUploader
                  name="importFile"
                  label="File to upload"
                  accept={accept}
                  buttonText="Choose file"
                  file={null}
                  fileName={file?.name}
                  onChange={setFile}
                  onDelete={() => setFile(null)}
                  disabled={busy}
                />
                <p className="journal-import__help">
                  Accepts {source.fileTypes.join(', ')}. The file is read and then discarded — it is
                  not stored on the server.
                </p>
              </>
            )}

            {error && <Alert variant="danger">{error}</Alert>}

            <div className="journal-import__panel-actions">
              {busy && <span className="journal-import__meta">{STAGE_TEXT[stage]}</span>}
              <CustomButton onClick={readFile} disabled={!source || !file} loading={busy}>
                <Upload size={16} aria-hidden="true" />
                Read file
              </CustomButton>
            </div>
          </div>
        ))}

      {tab === 'history' &&
        (historyBatchId ? (
          <ImportBatchView
            batchId={historyBatchId}
            sources={sources}
            exclusionReasons={exclusionReasons}
            onBack={() => setHistoryBatchId(null)}
          />
        ) : (
          <ImportHistory sources={sources} onOpen={setHistoryBatchId} />
        ))}

      {tab === 'journals' && <JournalList />}
    </div>
  );
};

export default JournalImport;
