import React, { useEffect, useMemo, useRef, useState } from 'react';

import CustomModal from '../../../shared/components/ui/CustomModal';
import { PROJECT_TYPE_OPTIONS } from '../constants';
import projectsApi from '../projectsApi';
import { vocabularyOptions } from '../selectOptions';
import { Field, SelectField } from './FormFields';

import type { ProjectOrganization, VocabularyEntry } from '../types';

interface RequestOptionModalProps {
  show: boolean;
  onHide: () => void;
  organizations: ProjectOrganization[];
  /** The admin-curated lists; the scheme's category is picked from them. */
  vocabulary: VocabularyEntry[];
  /** Pre-selected parent agency when the form already has one chosen. */
  defaultOrganizationId: number | null;
  /**
   * The project's type. A requested scheme is filed under it — the project
   * can only use a scheme of its own type — and its category list is that
   * type's.
   */
  projectType: string;
}

type RequestType = 'scheme' | 'organization';

/**
 * "Add Scheme" flow. Funding agencies and schemes are shared master data, so a
 * researcher requests an addition and an administrator approves it — the same
 * pattern the journal form uses for its option lists.
 */
const RequestOptionModal: React.FC<RequestOptionModalProps> = ({
  show,
  onHide,
  organizations,
  vocabulary,
  defaultOrganizationId,
  projectType,
}) => {
  const projectTypeLabel =
    PROJECT_TYPE_OPTIONS.find((option) => option.value === projectType)?.label ??
    'Research Project';
  const [requestType, setRequestType] = useState<RequestType>('scheme');
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState<string>(
    defaultOrganizationId ? String(defaultOrganizationId) : '',
  );
  const [organizationName, setOrganizationName] = useState('');
  const [category, setCategory] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [error, setError] = useState('');

  const organizationOptions = useMemo(
    () =>
      organizations
        .filter((organization) => organization.is_funding_agency !== 0)
        .map((organization) => ({
          value: String(organization.id),
          label: organization.name,
        })),
    [organizations],
  );

  const reset = () => {
    setRequestType('scheme');
    setName('');
    setOrganizationId(defaultOrganizationId ? String(defaultOrganizationId) : '');
    setOrganizationName('');
    setCategory('');
    setWebsite('');
    setStatus('idle');
    setError('');
  };

  const close = () => {
    reset();
    onHide();
  };

  // The modal mounts with the page, so the state initializer above runs long
  // before a funding agency is picked. Re-seed the parent agency each time the
  // dialog opens so it arrives pre-selected.
  const wasShown = useRef(show);
  useEffect(() => {
    if (show && !wasShown.current) {
      setOrganizationId(defaultOrganizationId ? String(defaultOrganizationId) : '');
    }
    wasShown.current = show;
  }, [show, defaultOrganizationId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Enter the name you would like added.');
      return;
    }
    if (requestType === 'scheme' && !organizationId && !organizationName.trim()) {
      setError('Tell us which funding agency offers this scheme.');
      return;
    }

    try {
      setStatus('saving');
      await projectsApi.createRequest({
        request_type: requestType,
        name: name.trim(),
        organization_id: requestType === 'scheme' && organizationId ? Number(organizationId) : null,
        organization_name: requestType === 'scheme' ? organizationName.trim() : '',
        project_type: requestType === 'scheme' ? projectType : null,
        category: category.trim(),
        website: website.trim(),
      });
      setStatus('sent');
    } catch (requestError) {
      setStatus('idle');
      setError((requestError as Error).message || 'The request could not be submitted.');
    }
  };

  return (
    <CustomModal
      show={show}
      onHide={close}
      title={status === 'sent' ? 'Request submitted' : 'Request a new scheme or agency'}
      size="lg"
      className="pf-modal"
    >
      {status === 'sent' ? (
        <div className="pf-modal__done">
          <p>
            Your request has been sent for approval. Once an administrator accepts it, the option
            appears in the dropdown here.
          </p>
          <button type="button" className="pf-btn pf-btn--primary" onClick={close}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="pf-modal__form">
          <Field label="What should be added?" className="pf-modal__type">
            <div className="pf-radio-group">
              {(
                [
                  { value: 'scheme', label: 'A scheme / call' },
                  { value: 'organization', label: 'A funding agency' },
                ] as const
              ).map((option) => (
                <label className="pf-radio" key={option.value}>
                  <input
                    type="radio"
                    name="requestType"
                    value={option.value}
                    checked={requestType === option.value}
                    onChange={() => {
                      setRequestType(option.value);
                      // The two kinds' categories are different lists, so a
                      // pick made for one is never carried to the other.
                      setCategory('');
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field
            label={requestType === 'scheme' ? 'Scheme name' : 'Funding agency name'}
            htmlFor="pf-request-name"
            hint={
              requestType === 'scheme'
                ? `Requested as a ${projectTypeLabel} scheme, the type of this project.`
                : undefined
            }
          >
            <input
              id="pf-request-name"
              type="text"
              className="pf-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
            />
          </Field>

          {requestType === 'scheme' && (
            <>
              <Field label="Funding agency" htmlFor="pf-request-organization">
                <SelectField
                  id="pf-request-organization"
                  value={organizationId}
                  onChange={setOrganizationId}
                  options={organizationOptions}
                  placeholder="Pick an existing agency"
                />
              </Field>

              {!organizationId && (
                <Field
                  label="…or name a new agency"
                  htmlFor="pf-request-organization-name"
                  hint="Used when the agency is not in the list yet."
                >
                  <input
                    id="pf-request-organization-name"
                    type="text"
                    className="pf-input"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    maxLength={255}
                  />
                </Field>
              )}
            </>
          )}

          <div className="pf-modal__pair">
            {/* A scheme's category is a closed list; an agency's is its type
                (Government, Private, …) and stays free text. */}
            <Field label="Category" htmlFor="pf-request-category">
              {requestType === 'scheme' ? (
                <SelectField
                  id="pf-request-category"
                  value={category}
                  onChange={setCategory}
                  options={vocabularyOptions(vocabulary, 'category', projectType)}
                  placeholder="Select Category"
                />
              ) : (
                <input
                  id="pf-request-category"
                  type="text"
                  className="pf-input"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  maxLength={150}
                />
              )}
            </Field>

            <Field label="Website" htmlFor="pf-request-website">
              <input
                id="pf-request-website"
                type="url"
                className="pf-input"
                placeholder="https://"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                maxLength={500}
              />
            </Field>
          </div>

          {error && <p className="pf-field__error">{error}</p>}

          <div className="pf-modal__actions">
            <button type="button" className="pf-btn pf-btn--ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="pf-btn pf-btn--primary" disabled={status === 'saving'}>
              {status === 'saving' ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      )}
    </CustomModal>
  );
};

export default RequestOptionModal;
