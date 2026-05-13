import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import CustomDropdown, { OptionType } from './ui/CustomDropdown';
import './AddPayeeModal.css';

export type AddPayeeBeneficiaryType = 'individual' | 'organization';

export interface AddPayeeModalPayee {
  id: string;
  payeeId?: number | null;
  payeeName: string;
  accountName: string;
  panNumber?: string;
  accountNo: string;
  accountType: string;
  bankName: string;
  branchName: string;
  ifsc: string;
  beneficiaryType: AddPayeeBeneficiaryType;
  beneficiaryOrg: string;
  organizationType?: string;
  msme?: string;
  gstin?: string;
  tdsDetails?: string;
  tdsSection?: string;
  url: string;
  amount: string;
  mode: string;
}

interface AddPayeeModalProps {
  show: boolean;
  onClose: () => void;
  onAddPayee: (payee: AddPayeeModalPayee) => Promise<void> | void;
  showAlert?: (message: React.ReactNode, type: 'success' | 'error' | 'warning' | 'info') => void;
  submitLabel?: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
}

interface PayeeTypeDraft {
  payeeName: string;
  accountName: string;
  panNumber: string;
  accountNo: string;
  accountType: string;
  bankName: string;
  branchName: string;
  ifsc: string;
}

interface OrganizationDraft extends PayeeTypeDraft {
  organizationType: string;
  msme: string;
  gstin: string;
  tdsDetails: string;
  tdsSection: string;
}

const BENEFICIARY_ORG_OPTIONS = ['KSRCT', 'KSREI', 'External'] as const;

const ORGANIZATION_TYPE_OPTIONS = [
  'Sole Proprietorship',
  'Partnership Firm',
  'Private Company',
  'Public Limited',
  'Trust / Society',
  'Government Entity',
];

const TDS_SECTION_OPTIONS = [
  '192 - Salary',
  '194C - Contractor / Work',
  '194J - Professional / Technical Services',
  '194H - Commission / Brokerage',
  '194I - Rent',
  '194Q - Purchase of Goods',
  '195 - Non-Resident Payments',
  'Others',
];

const INDIAN_BANK_OPTIONS = [
  'State Bank of India',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'Bank of India',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDFC FIRST Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Dhanlaxmi Bank',
  'Tamilnad Mercantile Bank',
  'RBL Bank',
  'Bandhan Bank',
  'CSB Bank',
  'DCB Bank',
  'Nainital Bank',
  'Jammu & Kashmir Bank',
  'IDBI Bank',
  'AU Small Finance Bank',
  'Ujjivan Small Finance Bank',
  'Equitas Small Finance Bank',
  'Jana Small Finance Bank',
  'Suryoday Small Finance Bank',
  'ESAF Small Finance Bank',
  'Fincare Small Finance Bank',
  'Utkarsh Small Finance Bank',
  'North East Small Finance Bank',
  'Capital Small Finance Bank',
  'Shivalik Small Finance Bank',
  'Airtel Payments Bank',
  'India Post Payments Bank',
  'Fino Payments Bank',
  'Paytm Payments Bank',
  'NSDL Payments Bank',
  'Aditya Birla Idea Payments Bank',
  'Deutsche Bank India',
  'HSBC India',
  'Standard Chartered Bank',
  'Citibank India',
  'DBS Bank India',
  'Barclays Bank',
  'BNP Paribas India',
  'JPMorgan Chase Bank India',
  'MUFG Bank India',
  'Mizuho Bank India',
  'Bank of America N.A. India',
  'American Express Banking Corp',
  'Societe Generale India',
  'Credit Agricole CIB India',
];

const emptyIndividualData: PayeeTypeDraft = {
  payeeName: '',
  accountName: '',
  panNumber: '',
  accountNo: '',
  accountType: '',
  bankName: '',
  branchName: '',
  ifsc: '',
};

const emptyOrganizationData: OrganizationDraft = {
  ...emptyIndividualData,
  organizationType: '',
  msme: '',
  gstin: '',
  tdsDetails: '',
  tdsSection: '',
};

const normalizePayeeText = (value: unknown): string => String(value ?? '').trim();

const isBeneficiaryOrgValue = (value: unknown): boolean =>
  BENEFICIARY_ORG_OPTIONS.some((option) => option === normalizePayeeText(value));

const resolveCanonicalPayeeName = (payeeName: unknown, accountName: unknown): string => {
  const normalizedPayeeName = normalizePayeeText(payeeName);
  const normalizedAccountName = normalizePayeeText(accountName);

  if (normalizedPayeeName && !isBeneficiaryOrgValue(normalizedPayeeName)) {
    return normalizedPayeeName;
  }

  return normalizedAccountName || normalizedPayeeName;
};

const resolveCanonicalBeneficiaryOrg = (
  beneficiaryOrg: unknown,
  legacyPayeeName?: unknown,
): string => {
  const normalizedBeneficiaryOrg = normalizePayeeText(beneficiaryOrg);
  if (normalizedBeneficiaryOrg) return normalizedBeneficiaryOrg;

  const normalizedLegacyPayeeName = normalizePayeeText(legacyPayeeName);
  return isBeneficiaryOrgValue(normalizedLegacyPayeeName) ? normalizedLegacyPayeeName : '';
};

const createPayeeId = () =>
  crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const dropdownBaseStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: '42px',
    height: '42px',
    borderRadius: '12px',
    borderColor: state.isFocused ? '#2b9ed6' : '#d6dce5',
    backgroundColor: '#f8fafc',
    boxShadow: state.isFocused ? '0 0 0 4px rgba(43, 158, 214, 0.2)' : 'none',
    '&:hover': {
      borderColor: state.isFocused ? '#2b9ed6' : '#d6dce5',
    },
  }),
  valueContainer: (base: any) => ({
    ...base,
    minHeight: '40px',
    height: '40px',
    padding: '0 14px',
    display: 'flex',
    alignItems: 'center',
  }),
  input: (base: any) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    lineHeight: '1.2',
    margin: 0,
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#4b5563',
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    lineHeight: '1.2',
    margin: 0,
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '40px',
    alignItems: 'center',
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    display: 'flex',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
};

const AddPayeeModal: React.FC<AddPayeeModalProps> = ({
  show,
  onClose,
  onAddPayee,
  showAlert,
  submitLabel = 'Submit',
  submittingLabel = 'Submitting...',
  isSubmitting = false,
}) => {
  const [beneficiaryType, setBeneficiaryType] = useState<AddPayeeBeneficiaryType>('individual');
  const [individualData, setIndividualData] = useState<PayeeTypeDraft>(emptyIndividualData);
  const [organizationData, setOrganizationData] = useState<OrganizationDraft>(emptyOrganizationData);
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newPanNumber, setNewPanNumber] = useState('');
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newAccountType, setNewAccountType] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newIfsc, setNewIfsc] = useState('');
  const [orgType, setOrgType] = useState('');
  const [msmeValue, setMsmeValue] = useState('');
  const [gstinValue, setGstinValue] = useState('');
  const [orgPanNumber, setOrgPanNumber] = useState('');
  const [tdsValue, setTdsValue] = useState('');
  const [tdsSectionValue, setTdsSectionValue] = useState('');

  const resetToEmpty = () => {
    setNewPayeeName('');
    setNewAccountName('');
    setNewPanNumber('');
    setNewAccountNo('');
    setNewAccountType('');
    setNewBankName('');
    setNewBranchName('');
    setNewIfsc('');
    setOrgType('');
    setMsmeValue('');
    setGstinValue('');
    setOrgPanNumber('');
    setTdsValue('');
    setTdsSectionValue('');
  };

  const saveCurrentData = () => {
    if (beneficiaryType === 'individual') {
      setIndividualData({
        payeeName: newPayeeName,
        accountName: newAccountName,
        panNumber: newPanNumber,
        accountNo: newAccountNo,
        accountType: newAccountType,
        bankName: newBankName,
        branchName: newBranchName,
        ifsc: newIfsc,
      });
      return;
    }

    setOrganizationData({
      payeeName: newPayeeName,
      accountName: newAccountName,
      organizationType: orgType,
      msme: msmeValue,
      gstin: gstinValue,
      panNumber: orgPanNumber,
      tdsDetails: tdsValue,
      tdsSection: tdsSectionValue,
      accountNo: newAccountNo,
      accountType: newAccountType,
      bankName: newBankName,
      branchName: newBranchName,
      ifsc: newIfsc,
    });
  };

  const loadDataForType = (type: AddPayeeBeneficiaryType) => {
    const data = type === 'individual' ? individualData : organizationData;
    setNewPayeeName(data.payeeName);
    setNewAccountName(data.accountName);
    setNewPanNumber(data.panNumber);
    setNewAccountNo(data.accountNo);
    setNewAccountType(data.accountType);
    setNewBankName(data.bankName);
    setNewBranchName(data.branchName);
    setNewIfsc(data.ifsc);

    if (type === 'organization') {
      setOrgType(organizationData.organizationType);
      setMsmeValue(organizationData.msme);
      setGstinValue(organizationData.gstin);
      setOrgPanNumber(organizationData.panNumber);
      setTdsValue(organizationData.tdsDetails);
      setTdsSectionValue(organizationData.tdsSection);
      return;
    }

    setOrgType('');
    setMsmeValue('');
    setGstinValue('');
    setOrgPanNumber('');
    setTdsValue('');
    setTdsSectionValue('');
  };

  useEffect(() => {
    if (!show) return;

    setBeneficiaryType('individual');
    resetToEmpty();
    setIndividualData(emptyIndividualData);
    setOrganizationData(emptyOrganizationData);
  }, [show]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && show && !isSubmitting) onClose();
    };

    if (show) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [show, isSubmitting, onClose]);

  const handleToggle = (type: AddPayeeBeneficiaryType) => {
    if (isSubmitting || type === beneficiaryType) return;
    saveCurrentData();
    setBeneficiaryType(type);
    loadDataForType(type);
  };

  const handleModalSubmit = async () => {
    if (isSubmitting) return;

    const canonicalPayeeName = resolveCanonicalPayeeName('', newAccountName);
    const accountNo = normalizePayeeText(newAccountNo);
    const bankName = normalizePayeeText(newBankName);
    const branchName = normalizePayeeText(newBranchName);
    const ifsc = normalizePayeeText(newIfsc).toUpperCase();

    if (!canonicalPayeeName || !accountNo || !ifsc || !bankName || !branchName) {
      showAlert?.('Please enter accountant name, account number, IFSC, bank name and branch name', 'warning');
      return;
    }

    await onAddPayee({
      id: createPayeeId(),
      payeeName: canonicalPayeeName,
      accountName: canonicalPayeeName,
      bankName,
      accountNo,
      ifsc,
      branchName,
      url: '',
      amount: '',
      mode: '',
      accountType: normalizePayeeText(newAccountType),
      beneficiaryType,
      beneficiaryOrg: resolveCanonicalBeneficiaryOrg('', newPayeeName),
      ...(beneficiaryType === 'individual' && { panNumber: normalizePayeeText(newPanNumber).toUpperCase() }),
      ...(beneficiaryType === 'organization' && {
        organizationType: normalizePayeeText(orgType),
        msme: normalizePayeeText(msmeValue),
        gstin: normalizePayeeText(gstinValue).toUpperCase(),
        panNumber: normalizePayeeText(orgPanNumber).toUpperCase(),
        tdsDetails: normalizePayeeText(tdsValue),
        tdsSection: tdsValue === 'Yes' ? normalizePayeeText(tdsSectionValue) : '',
      }),
    });
  };

  if (!show) return null;

  return (
    <div
      className="add-payee-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="add-payee-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="add-payee-modal-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close add payee"
        >
          <X size={18} />
        </button>

        <div className="add-payee-modal-content">
          <div className="payee-modal-toggle">
            <button
              type="button"
              onClick={() => handleToggle('individual')}
              className={`payee-modal-toggle-btn ${beneficiaryType === 'individual' ? 'active' : ''}`}
              disabled={isSubmitting}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => handleToggle('organization')}
              className={`payee-modal-toggle-btn ${beneficiaryType === 'organization' ? 'active' : ''}`}
              disabled={isSubmitting}
            >
              Organization
            </button>
          </div>

          {beneficiaryType === 'individual' && (
            <div className="add-payee-modal-section">
              <div className="add-payee-modal-row">
                <label>Beneficiary</label>
                <div className="add-payee-modal-radio-group">
                  {BENEFICIARY_ORG_OPTIONS.map((option) => (
                    <label key={option} className="add-payee-modal-radio">
                      <input
                        type="radio"
                        name="beneficiaryInd"
                        value={option}
                        checked={newPayeeName === option}
                        onChange={() => setNewPayeeName(option)}
                        disabled={isSubmitting}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="add-payee-modal-row">
                <label>Accountant Name</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder="Enter accountant name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>PAN Number</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newPanNumber}
                  onChange={(event) => setNewPanNumber(event.target.value.toUpperCase())}
                  placeholder="Enter PAN number"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {beneficiaryType === 'organization' && (
            <div className="add-payee-modal-section">
              <div className="add-payee-modal-row">
                <label>Beneficiary</label>
                <div className="add-payee-modal-radio-group">
                  {BENEFICIARY_ORG_OPTIONS.map((option) => (
                    <label key={option} className="add-payee-modal-radio">
                      <input
                        type="radio"
                        name="beneficiaryOrg"
                        value={option}
                        checked={newPayeeName === option}
                        onChange={() => setNewPayeeName(option)}
                        disabled={isSubmitting}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="add-payee-modal-row">
                <label>Accountant Name</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value)}
                  placeholder="Enter accountant name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>Organization Type</label>
                <CustomDropdown
                  className="organization-type-dropdown"
                  options={ORGANIZATION_TYPE_OPTIONS.map((option) => ({ value: option, label: option }))}
                  value={orgType ? { value: orgType, label: orgType } : null}
                  onChange={(option) => {
                    const selected = option as OptionType | null;
                    setOrgType(selected?.value ? String(selected.value) : '');
                  }}
                  placeholder="Select Organization Type"
                  isDisabled={isSubmitting}
                  styles={{ ...dropdownBaseStyles, menuPortal: (base: any) => ({ ...base, zIndex: 9999 }) }}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>MSME</label>
                <div className="add-payee-modal-radio-group">
                  <label className="add-payee-modal-radio">
                    <input
                      type="radio"
                      name="msme"
                      value="Yes"
                      checked={msmeValue === 'Yes'}
                      onChange={(event) => setMsmeValue(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="add-payee-modal-radio">
                    <input
                      type="radio"
                      name="msme"
                      value="No"
                      checked={msmeValue === 'No'}
                      onChange={(event) => setMsmeValue(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>
              <div className="add-payee-modal-row">
                <label>GSTIN</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={gstinValue}
                  onChange={(event) => setGstinValue(event.target.value.toUpperCase())}
                  placeholder="Enter GSTIN"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>PAN Number</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={orgPanNumber}
                  onChange={(event) => setOrgPanNumber(event.target.value.toUpperCase())}
                  placeholder="Enter PAN number"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row add-payee-modal-row--tds">
                <label>TDS Details</label>
                <div className="add-payee-modal-radio-group add-payee-modal-tds-control">
                  <label className="add-payee-modal-radio">
                    <input
                      type="radio"
                      name="tds"
                      value="Yes"
                      checked={tdsValue === 'Yes'}
                      onChange={(event) => setTdsValue(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="add-payee-modal-radio">
                    <input
                      type="radio"
                      name="tds"
                      value="No"
                      checked={tdsValue === 'No'}
                      onChange={(event) => setTdsValue(event.target.value)}
                      disabled={isSubmitting}
                    />
                    <span>No</span>
                  </label>
                  <div className={`add-payee-modal-tds-section ${tdsValue === 'Yes' ? 'visible' : ''}`}>
                    <CustomDropdown
                      className="tds-section-dropdown"
                      options={TDS_SECTION_OPTIONS.map((option) => ({ value: option, label: option }))}
                      value={tdsSectionValue ? { value: tdsSectionValue, label: tdsSectionValue } : null}
                      onChange={(option) => {
                        const selected = option as OptionType | null;
                        setTdsSectionValue(selected?.value ? String(selected.value) : '');
                      }}
                      placeholder="Select TDS Section"
                      isDisabled={isSubmitting || tdsValue !== 'Yes'}
                      styles={{ ...dropdownBaseStyles, container: (base: any) => ({ ...base, width: '100%', flex: 1 }) }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="add-payee-modal-section add-payee-modal-section--bank">
            <div className="add-payee-modal-row">
              <label>Account Number</label>
              <input
                className="payee-modal-field-input"
                type="text"
                value={newAccountNo}
                onChange={(event) => setNewAccountNo(event.target.value)}
                placeholder="Enter account number"
                disabled={isSubmitting}
              />
            </div>
            <div className="add-payee-modal-row">
              <label>Account Type</label>
              <div className="add-payee-modal-radio-group">
                <label className="add-payee-modal-radio">
                  <input
                    type="radio"
                    name="accountType"
                    value="Savings"
                    checked={newAccountType === 'Savings'}
                    onChange={() => setNewAccountType('Savings')}
                    disabled={isSubmitting}
                  />
                  <span>Savings</span>
                </label>
                <label className="add-payee-modal-radio">
                  <input
                    type="radio"
                    name="accountType"
                    value="Current"
                    checked={newAccountType === 'Current'}
                    onChange={() => setNewAccountType('Current')}
                    disabled={isSubmitting}
                  />
                  <span>Current</span>
                </label>
              </div>
            </div>
            <div className="add-payee-modal-row">
              <label>Bank Name</label>
              <CustomDropdown
                className="payee-modal-select-dropdown"
                options={INDIAN_BANK_OPTIONS.map((bank) => ({ value: bank, label: bank }))}
                value={newBankName ? { value: newBankName, label: newBankName } : null}
                onChange={(option) => {
                  const selected = option as OptionType | null;
                  setNewBankName(selected?.value ? String(selected.value) : '');
                }}
                placeholder="Select bank name"
                isDisabled={isSubmitting}
                styles={dropdownBaseStyles}
              />
            </div>
            <div className="add-payee-modal-row">
              <label>Branch Name</label>
              <input
                className="payee-modal-field-input"
                type="text"
                value={newBranchName}
                onChange={(event) => setNewBranchName(event.target.value)}
                placeholder="Enter branch name"
                disabled={isSubmitting}
              />
            </div>
            <div className="add-payee-modal-row">
              <label>IFSC Code</label>
              <input
                className="payee-modal-field-input"
                type="text"
                value={newIfsc}
                onChange={(event) => setNewIfsc(event.target.value.toUpperCase())}
                placeholder="Enter IFSC code"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="button"
            className="add-payee-modal-submit"
            onClick={handleModalSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPayeeModal;
