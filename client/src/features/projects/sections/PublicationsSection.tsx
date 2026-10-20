import { Loader2 } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import RowExpandToggle from '../components/RowExpandToggle';
import SectionCard from '../components/SectionCard';
import { useSingleExpandedRow } from '../components/useSingleExpandedRow';
import { MAX_OUTCOME_ROWS, PUBLICATION_TYPE_OPTIONS } from '../constants';
import { createPublicationRow, replaceAt, withoutRow } from '../projectFormState';
import projectsApi from '../projectsApi';

import type { ProjectFormState, PublicationRow } from '../types';

interface PublicationsSectionProps {
  rows: PublicationRow[];
  patch: (changes: Partial<ProjectFormState>) => void;
  errors: Record<string, string>;
  disabled: boolean;
}

/** The fields a publication row keeps in its expanded detail strip. */
const DETAIL_ERROR_KEYS = ['publication_year'];

/** What the last Fetch on a row said, shown under its DOI. Presentational only. */
interface FetchNote {
  pending: boolean;
  message: string;
  isError: boolean;
}

/**
 * The Outcomes tab's publications, one row per paper by DOI.
 *
 * Fetch asks the server for the DOI's details: a publication already entered in
 * the portal's Journals module comes back linked to that record, and any other
 * DOI is looked up on Crossref. What comes back fills the title, venue and year
 * in the row's strip, where they stay editable — a DOI nobody can resolve is
 * still saved with details typed by hand.
 */
const PublicationsSection: React.FC<PublicationsSectionProps> = ({
  rows,
  patch,
  errors,
  disabled,
}) => {
  const { openRow, openOnly, toggleRow } = useSingleExpandedRow(rows.map((row) => row.key));
  const [notes, setNotes] = useState<Record<string, FetchNote>>({});

  // A Fetch resolves after the user may have kept typing, so its result is
  // written into the rows as they are then — found by key — rather than into
  // the list captured when the button was pressed.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const setNote = (rowKey: string, note: FetchNote | null) =>
    setNotes((current) => {
      const next = { ...current };
      if (note) next[rowKey] = note;
      else delete next[rowKey];
      return next;
    });

  const updateRow = (index: number, changes: Partial<PublicationRow>) => {
    openOnly(rows[index].key);
    patch({ publications: replaceAt(rows, index, changes) });
  };

  const addRow = () => {
    const row = createPublicationRow();
    openOnly(row.key);
    patch({ publications: [...rows, row] });
  };

  const fetchDetails = async (rowKey: string, doi: string) => {
    setNote(rowKey, { pending: true, message: '', isError: false });
    try {
      const found = await projectsApi.lookupDoi(doi);
      const latest = rowsRef.current;
      const index = latest.findIndex((row) => row.key === rowKey);
      if (index === -1) return;

      const row = latest[index];
      // The DOI was edited while this Fetch was out, so its answer is for a DOI
      // the row no longer holds; the edit already cleared the pending note.
      if (row.doi.trim() !== doi.trim()) return;
      patch({
        publications: replaceAt(latest, index, {
          doi: found.doi,
          journalId: found.journal_id,
          // A type the user already picked is theirs; the lookup only fills
          // one in.
          publicationType: row.publicationType || found.publication_type || '',
          title: found.title ?? row.title,
          venue: found.venue ?? row.venue,
          publicationYear: found.publication_year
            ? String(found.publication_year)
            : row.publicationYear,
        }),
      });
      openOnly(rowKey);
      setNote(rowKey, {
        pending: false,
        isError: false,
        message:
          found.source === 'portal'
            ? 'Linked to the publication in the portal’s Journals.'
            : 'Details filled from Crossref — check them below.',
      });
    } catch (error) {
      setNote(rowKey, {
        pending: false,
        isError: true,
        message: (error as Error).message || 'Failed to look up the DOI.',
      });
    }
  };

  return (
    <SectionCard title="Publication">
      <div className="pf-table-wrap">
        <table className="pf-table pf-outcome-table">
          <thead>
            <tr>
              <th scope="col" className="pf-table__sno">
                S.No.
              </th>
              <th scope="col" className="pf-outcome-table__type">
                Type
              </th>
              <th scope="col">DOI</th>
              <th scope="col" className="pf-table__actions">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const field = `publications[${index}]`;
              const hasDetailError = DETAIL_ERROR_KEYS.some((key) => errors[`${field}.${key}`]);
              const isExpanded = openRow === row.key || hasDetailError;
              const detailId = `${row.key}-detail`;
              const note = notes[row.key];

              return (
                <React.Fragment key={row.key}>
                  <tr>
                    <td className="pf-table__sno">{index + 1}</td>

                    <td className="pf-outcome-table__type">
                      <SelectField
                        value={row.publicationType}
                        onChange={(value) => updateRow(index, { publicationType: value })}
                        options={PUBLICATION_TYPE_OPTIONS}
                        disabled={disabled}
                        invalid={Boolean(errors[`${field}.publication_type`])}
                        ariaLabel="Publication type"
                      />
                    </td>

                    <td>
                      <div className="pf-outcome-lookup">
                        <input
                          type="text"
                          className={`pf-input ${errors[`${field}.doi`] ? 'is-invalid' : ''}`.trim()}
                          value={row.doi}
                          onChange={(event) => {
                            setNote(row.key, null);
                            // The link was to the record the old DOI matched,
                            // so a changed DOI drops it until it is fetched.
                            updateRow(index, { doi: event.target.value, journalId: null });
                          }}
                          placeholder="10.xxxx/xxxxx"
                          disabled={disabled}
                          aria-label="DOI"
                        />
                        <button
                          type="button"
                          className="pf-btn pf-btn--primary pf-btn--sm pf-outcome-lookup__fetch"
                          onClick={() => fetchDetails(row.key, row.doi)}
                          disabled={disabled || !row.doi.trim() || note?.pending}
                        >
                          {note?.pending ? (
                            <Loader2 size={14} className="pf-spinner" aria-hidden="true" />
                          ) : null}
                          Fetch
                        </button>
                      </div>
                      {note && !note.pending && (
                        <p
                          className={note.isError ? 'pf-field__error' : 'pf-field__hint'}
                          role="status"
                        >
                          {note.message}
                        </p>
                      )}
                    </td>

                    <td className="pf-table__actions">
                      <RowActions
                        itemLabel="publication"
                        leading={
                          <RowExpandToggle
                            isExpanded={isExpanded}
                            onToggle={() => toggleRow(row.key)}
                            controls={detailId}
                            detailLabel="title, venue and year"
                            lockedLabel={
                              hasDetailError ? 'Fix the year to collapse this row' : undefined
                            }
                          />
                        }
                        onAdd={addRow}
                        showAdd={index === rows.length - 1}
                        addDisabled={rows.length >= MAX_OUTCOME_ROWS}
                        onRemove={() => {
                          setNote(row.key, null);
                          patch({ publications: withoutRow(rows, index, createPublicationRow) });
                        }}
                        disabled={disabled}
                      />
                    </td>
                  </tr>

                  <tr id={detailId} className="pf-ledger__detail-row" hidden={!isExpanded}>
                    <td className="pf-ledger__detail-cell" colSpan={4}>
                      <div className="pf-ledger__detail">
                        <label className="pf-ledger__detail-field pf-ledger__detail-field--wide">
                          <span className="pf-ledger__detail-label">Title</span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.title}
                            onChange={(event) => updateRow(index, { title: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-outcome-table__venue">
                          <span className="pf-ledger__detail-label">
                            {row.publicationType === 'book_chapter'
                              ? 'Book'
                              : row.publicationType === 'conference'
                                ? 'Conference'
                                : 'Journal'}
                          </span>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.venue}
                            onChange={(event) => updateRow(index, { venue: event.target.value })}
                            disabled={disabled}
                          />
                        </label>

                        <label className="pf-ledger__detail-field pf-ledger__detail-field--compact pf-outcome-table__year">
                          <span className="pf-ledger__detail-label">Year</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            className={`pf-input ${errors[`${field}.publication_year`] ? 'is-invalid' : ''}`.trim()}
                            value={row.publicationYear}
                            onChange={(event) =>
                              updateRow(index, { publicationYear: event.target.value })
                            }
                            disabled={disabled}
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export default PublicationsSection;
