import { Linkedin, Globe } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import './OrganizationDirectory.css';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomInput from '../../shared/components/ui/CustomInput';

/* ─── Types ─────────────────────────────────────────────── */

export interface Organization {
  id: number;
  name: string;
  abbreviation: string;
  establishmentYear: string;
  sector: string;
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
];

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
  const [sector, setSector] = useState('');
  const [tag, setTag] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedIn, setLinkedIn] = useState('');

  /* Address fields */
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
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
      setSector(editingOrg.sector || '');
      setTag(editingOrg.tag || '');
      setWebsite(editingOrg.website || '');
      setLinkedIn(editingOrg.linkedIn || '');
      setAddress(editingOrg.address || '');
      setCity(editingOrg.city || '');
      setState(editingOrg.state || '');
      setCountry(editingOrg.country || '');
      setPinCode(editingOrg.pinCode || '');
      setStatus(editingOrg.status || 'Active');
    }
  }, [editingOrg]);

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
      sector: sector.trim(),
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
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6' }}>
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
              <div className="orgd-field" style={{ flex: '1' }}>
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
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6' }}>
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
                style={{ flex: '1', border: 'none', padding: 0, margin: 0 }}
              >
                <legend
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: '#344054',
                    marginBottom: '8px',
                  }}
                >
                  Status
                </legend>
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
          <div className="orgd-field">
            <CustomInput
              label="State"
              name="orgd-state-input"
              value={state}
              onChange={setState}
              placeholder="State"
              className="mb-0"
            />
          </div>
          <div className="orgd-field">
            <CustomInput
              label="Country"
              name="orgd-country-input"
              value={country}
              onChange={setCountry}
              placeholder="Country"
              className="mb-0"
            />
          </div>
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
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
          <div className="orgd-field" style={{ flex: '0 0 180px' }}>
            <CustomInput
              label="Tag"
              name="orgd-tag-input"
              value={tag}
              onChange={setTag}
              placeholder="Tag"
              className="mb-0"
            />
          </div>
          <div className="orgd-field" style={{ flex: '1' }}>
            <CustomInput
              label="Specialization"
              name="orgd-sector-input"
              value={sector}
              onChange={setSector}
              placeholder="Specialization"
              className="mb-0"
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
            fontSize: '0.9rem',
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
