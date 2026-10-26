import { Linkedin, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './OrganizationDirectory.css';
import RegionFields from '../../shared/components/RegionFields';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomDropdown from '../../shared/components/ui/CustomDropdown';
import CustomInput from '../../shared/components/ui/CustomInput';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { DEFAULT_COUNTRY } from '../../shared/utils/regions';

/* ─── Types ─────────────────────────────────────────────── */

export interface Organization {
  id: number;
  name: string;
  abbreviation: string;
  establishmentYear: string;
  /** Picked from the Directory Admin's Specialization list. */
  specializations: string[];
  category: string;
  tag: string;
  website: string;
  linkedIn: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  date: string;
  status: string; // 'Active' | 'Inactive'
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  isOwner?: boolean;
  /** Who added the record, so a reader can ask them about it. */
  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
}

interface OrganizationDirectoryProps {
  editingOrg: Organization | null;
  onSave: (orgData: Omit<Organization, 'id' | 'date'>) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

const CATEGORY_OPTIONS = [
  'Academic',
  'Industry',
  'National Labs',
  'Incubation',
  'Start-up',
  'Government',
  'Others',
];

// Tag and Specialization sit on --control-height like the inputs beside them; the colours
// and corners match this form's own inputs. CustomDropdown merges styles shallowly, so the
// control restates them.
const listDropdownStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    minHeight: 'var(--control-height)',
    height: 'var(--control-height)',
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#0069ab' : '#e0e0e0',
    borderRadius: '12px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
    '&:hover': { borderColor: '#0069ab' },
  }),
  valueContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
    padding: '0 12px',
  }),
  indicatorsContainer: (provided: any) => ({
    ...provided,
    minHeight: 'calc(var(--control-height) - 2px)',
    height: 'calc(var(--control-height) - 2px)',
  }),
  // Text per AGENTS.md typography: 14px, primary-text colour.
  container: (provided: any) => ({ ...provided, fontSize: 'var(--font-size-body)' }),
  singleValue: (provided: any) => ({ ...provided, color: 'var(--text-body)' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

// Several picks stay on one line and scroll sideways, so the field never grows taller
// than the Tag dropdown beside it.
const specializationDropdownStyles = {
  ...listDropdownStyles,
  valueContainer: (provided: any) => ({
    ...listDropdownStyles.valueContainer(provided),
    flexWrap: 'nowrap',
    overflowX: 'auto',
  }),
  multiValue: (provided: any) => ({ ...provided, flexShrink: 0, borderRadius: '6px' }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    fontSize: 'var(--font-size-secondary)',
    color: 'var(--text-body)',
  }),
  // A read-only view shows the picks without the remove button they could not use.
  multiValueRemove: (provided: any, state: any) =>
    state.selectProps.isDisabled ? { display: 'none' } : provided,
};

/** A stored value the list no longer offers is still shown, so an edit never drops it. */
const toOptions = (names: string[], selected: string[]) =>
  [...names, ...selected.filter((value) => value && !names.includes(value))].map((name) => ({
    value: name,
    label: name,
  }));

/* ═══════════════════════════════════════════════════════════
   Organization Form Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectory: React.FC<OrganizationDirectoryProps> = ({
  editingOrg,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  /* form fields */
  const [category, setCategory] = useState('Academic');
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [establishmentYear, setEstablishmentYear] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [listNames, setListNames] = useState<{ tag: string[]; specialization: string[] }>({
    tag: [],
    specialization: [],
  });
  const [listError, setListError] = useState<string | null>(null);
  const [tag, setTag] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedIn, setLinkedIn] = useState('');

  /* Address fields */
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [pinCode, setPinCode] = useState('');

  const [status, setStatus] = useState('Active');
  const [formError, setFormError] = useState<string | null>(null);

  /* Initialize form values */
  useEffect(() => {
    if (editingOrg) {
      setCategory(editingOrg.category || 'Academic');
      setName(editingOrg.name || '');
      setAbbreviation(editingOrg.abbreviation || '');
      setEstablishmentYear(editingOrg.establishmentYear || '');
      setSpecializations(editingOrg.specializations || []);
      setTag(editingOrg.tag || '');
      setWebsite(editingOrg.website || '');
      setLinkedIn(editingOrg.linkedIn || '');
      setAddress(editingOrg.address || '');
      setCity(editingOrg.city || '');
      setState(editingOrg.state || '');
      setCountry(editingOrg.country || DEFAULT_COUNTRY);
      setPinCode(editingOrg.pinCode || '');
      setStatus(editingOrg.status || 'Active');
    }
  }, [editingOrg]);

  // Tag and Specialization come from the Directory Admin's lists; a read-only view shows
  // the stored values and needs no list.
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    authenticityUtility
      .get('/directory-options')
      .then((response: any) => {
        if (cancelled) return;
        const rows: { list_key: string; name: string }[] = response?.data || [];
        setListNames({
          tag: rows.filter((row) => row.list_key === 'tag').map((row) => row.name),
          specialization: rows
            .filter((row) => row.list_key === 'specialization')
            .map((row) => row.name),
        });
        setListError(null);
      })
      .catch((err: any) => {
        if (!cancelled)
          setListError(err?.message || 'Failed to load the Tag and Specialization lists.');
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  const handleSubmit = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Please fill in the Organization Name field.');
      return;
    }
    onSave({
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      establishmentYear: establishmentYear.trim(),
      specializations,
      category,
      tag: tag.trim() || 'General',
      website: website.trim(),
      linkedIn: linkedIn.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      pinCode: pinCode.trim(),
      status,
    });
  };

  return (
    <div className="orgd-form-wrapper">
      <div className="orgd-card" style={readOnly ? { pointerEvents: 'none' } : undefined}>
        {/* Category Section */}
        <h5 className="orgd-section-title">Category</h5>
        <div className="orgd-category-chips" role="group" aria-label="Category Selector">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`orgd-chip${category === cat ? ' active' : ''}`}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
            >
              {cat}
            </button>
          ))}
        </div>

        <hr className="orgd-section-title-line" />

        {/* Organization Details Section */}
        <h5 className="orgd-section-title">Organization Details</h5>

        <div className="orgd-split-row">
          {/* Left panel - Basic fields */}
          <div className="orgd-left-col">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6', minWidth: '200px' }}>
                {/* CustomInput's label is plain text, so the label sits outside to keep the
                    red required marker; CustomInput uses `name` as the input id. */}
                <label htmlFor="orgd-name-input">
                  Organization Name <span className="req">*</span>
                </label>
                <CustomInput
                  name="orgd-name-input"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. KSRCT Research Center"
                  className="mb-0"
                />
              </div>
              <div className="orgd-field" style={{ flex: '1', minWidth: '160px' }}>
                <CustomInput
                  label="Abbreviation / Short Name"
                  name="orgd-abbrev-input"
                  value={abbreviation}
                  onChange={setAbbreviation}
                  placeholder="e.g. KSRCT-RC"
                  className="mb-0"
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6', minWidth: '200px' }}>
                <CustomInput
                  label="Address"
                  name="orgd-address-input"
                  value={address}
                  onChange={setAddress}
                  placeholder="Address line"
                  className="mb-0"
                />
              </div>
              <fieldset
                className="orgd-field"
                style={{ flex: '1 0 auto', border: 'none', padding: 0, margin: 0 }}
              >
                <legend className="orgd-legend">Status</legend>
                <div className="orgd-toggle-group">
                  {['Active', 'Inactive'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`orgd-toggle-btn${status === s ? ' active' : ''}`}
                      onClick={() => setStatus(s)}
                      aria-pressed={status === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {/* Right panel - Website and LinkedIn grouped in light blue box */}
          <div className="orgd-right-col-box">
            <div className="orgd-field">
              <div className="orgd-input-icon-wrapper">
                <Globe size={16} color="#0069ab" aria-hidden="true" />
                <CustomInput
                  name="orgd-website-input"
                  type="url"
                  value={website}
                  onChange={setWebsite}
                  placeholder="Website"
                  aria-label="Website"
                  className="mb-0"
                />
              </div>
            </div>

            <div className="orgd-field">
              <div className="orgd-input-icon-wrapper">
                <Linkedin size={16} color="#0069ab" aria-hidden="true" />
                <CustomInput
                  name="orgd-linkedin-input"
                  type="url"
                  value={linkedIn}
                  onChange={setLinkedIn}
                  placeholder="LinkedIn Profile"
                  aria-label="LinkedIn Profile"
                  className="mb-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* City, State, Country, PIN Row */}
        <div className="orgd-row-4" style={{ marginTop: '8px', marginBottom: '16px' }}>
          <div className="orgd-field">
            <CustomInput
              label="City"
              name="orgd-city-input"
              value={city}
              onChange={setCity}
              placeholder="City"
              className="mb-0"
            />
          </div>
          <RegionFields
            idPrefix="orgd"
            country={country}
            state={state}
            onChange={(region) => {
              setCountry(region.country);
              setState(region.state);
            }}
            disabled={readOnly}
            fieldClassName="orgd-field"
            dropdownStyles={listDropdownStyles}
          />
          <div className="orgd-field">
            <CustomInput
              label="PIN"
              name="orgd-pin-input"
              value={pinCode}
              onChange={setPinCode}
              placeholder="PIN"
              className="mb-0"
            />
          </div>
        </div>

        {/* Tag and Specialization (Sector) Row */}
        <div className="orgd-list-row">
          <div className="orgd-field orgd-list-row__tag">
            <label>Tag</label>
            <CustomDropdown
              name="orgd-tag"
              className="mb-0"
              value={tag ? { value: tag, label: tag } : null}
              onChange={(option: any) => setTag(option ? String(option.value) : '')}
              options={toOptions(listNames.tag, [tag])}
              placeholder="Select tag"
              styles={listDropdownStyles}
              isDisabled={readOnly}
              isClearable
              error={listError || undefined}
            />
          </div>
          <div className="orgd-field orgd-list-row__specialization">
            <label>Specialization</label>
            <CustomDropdown
              name="orgd-specializations"
              className="mb-0"
              isMulti
              value={specializations.map((name) => ({ value: name, label: name }))}
              onChange={(options: any) =>
                setSpecializations((options || []).map((option: any) => String(option.value)))
              }
              options={toOptions(listNames.specialization, specializations)}
              placeholder="Select specializations"
              styles={specializationDropdownStyles}
              isDisabled={readOnly}
            />
          </div>
        </div>
      </div>

      {/* Form actions - outside the card */}
      {formError && (
        <div
          role="alert"
          style={{
            color: '#b91c1c',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '12px',
            fontSize: 'var(--font-size-body)',
          }}
        >
          {formError}
        </div>
      )}
      {!readOnly && (
        <div className="orgd-actions-row">
          <CustomButton className="orgd-btn-save" onClick={handleSubmit}>
            {editingOrg !== null ? 'Update Record' : 'Save Record'}
          </CustomButton>
          <CustomButton variant="light" className="orgd-btn-cancel" onClick={onCancel}>
            Cancel
          </CustomButton>
        </div>
      )}
    </div>
  );
};

export default OrganizationDirectory;
