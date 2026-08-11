import React, { useState, useEffect } from 'react';
import {
  Linkedin, Globe
} from 'lucide-react';
import './OrganizationDirectory.css';
import { useAbility } from '../../shared/casl/AbilityContext';

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
}

interface OrganizationDirectoryProps {
  editingOrg: Organization | null;
  onSave: (orgData: Omit<Organization, 'id' | 'date'>) => void;
  onCancel: () => void;
}

const CATEGORY_OPTIONS = [
  'Academic', 'Industry', 'National Labs', 'Incubation', 'Start-up', 'Government'
];

/* ═══════════════════════════════════════════════════════════
   Organization Form Component
   ═══════════════════════════════════════════════════════════ */

const OrganizationDirectory: React.FC<OrganizationDirectoryProps> = ({
  editingOrg,
  onSave,
  onCancel,
}) => {
  const ability = useAbility();
  const isAllowed = editingOrg !== null
    ? ability.can('edit', 'MasterData')
    : ability.can('create', 'MasterData');
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
    if (!isAllowed) {
      setFormError('You do not have permission to perform this action.');
      return;
    }
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
      <div className="orgd-card">
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
                <label htmlFor="orgd-name-input">Organization Name <span className="req">*</span></label>
                <input
                  id="orgd-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. KSRCT Research Center"
                />
              </div>
              <div className="orgd-field" style={{ flex: '1' }}>
                <label htmlFor="orgd-abbrev-input">Abbreviation / Short Name</label>
                <input
                  id="orgd-abbrev-input"
                  type="text"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="e.g. KSRCT-RC"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="orgd-field" style={{ flex: '1.6' }}>
                <label htmlFor="orgd-address-input">Address</label>
                <input
                  id="orgd-address-input"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address line"
                />
              </div>
              <fieldset className="orgd-field" style={{ flex: '1', border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontSize: '0.9rem', fontWeight: 600, color: '#344054', marginBottom: '8px' }}>Status</legend>
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
                <Globe size={16} />
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="Website"
                  aria-label="Website"
                />

              </div>
            </div>

            <div className="orgd-field">
              <div className="orgd-input-icon-wrapper">
                <Linkedin size={16} />
                <input
                  type="url"
                  value={linkedIn}
                  onChange={(e) => setLinkedIn(e.target.value)}
                  placeholder="LinkedIn Profile"
                  aria-label="LinkedIn Profile"
                />

              </div>
            </div>
          </div>
        </div>



        {/* City, State, Country, PIN Row */}
        <div className="orgd-row-4" style={{ marginTop: '8px', marginBottom: '16px' }}>
          <div className="orgd-field">
            <label htmlFor="orgd-city-input">City</label>
            <input
              id="orgd-city-input"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="orgd-field">
            <label htmlFor="orgd-state-input">State</label>
            <input
              id="orgd-state-input"
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
            />
          </div>
          <div className="orgd-field">
            <label htmlFor="orgd-country-input">Country</label>
            <input
              id="orgd-country-input"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
            />
          </div>
          <div className="orgd-field">
            <label htmlFor="orgd-pin-input">PIN</label>
            <input
              id="orgd-pin-input"
              type="text"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="PIN"
            />
          </div>
        </div>

        {/* Tag and Specialization (Sector) Row */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
          <div className="orgd-field" style={{ flex: '0 0 180px' }}>
            <label htmlFor="orgd-tag-input">Tag</label>
            <input
              id="orgd-tag-input"
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Tag"
            />
          </div>
          <div className="orgd-field" style={{ flex: '1' }}>
            <label htmlFor="orgd-sector-input">Specialization</label>
            <input
              id="orgd-sector-input"
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Specialization"
            />
          </div>
        </div>



      </div>

      {/* Form actions - outside the card */}
      {formError && (
        <div role="alert" style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', fontSize: '0.9rem' }}>
          {formError}
        </div>
      )}
      <div className="orgd-actions-row">
        <button
          type="button"
          className="orgd-btn-save"
          onClick={handleSubmit}
          disabled={!isAllowed}
        >
          {editingOrg !== null ? 'Update Record' : 'Save Record'}
        </button>
        <button
          type="button"
          className="orgd-btn-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

    </div>
  );
};

export default OrganizationDirectory;