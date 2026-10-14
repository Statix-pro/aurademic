import { CheckCircle2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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
  /** Student / Faculty / Staff — carried only by a KSRCT or KSREI individual. */
  beneficiaryCategory?: string;
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
  beneficiaryCategory: string;
  accountName: string;
  panNumber: string;
  accountNo: string;
  confirmAccountNo: string;
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

const BENEFICIARY_CATEGORY_OPTIONS = ['Student', 'Faculty', 'Staff'] as const;

/**
 * A KSRCT or KSREI beneficiary is someone from inside the institution, and
 * Finance reports on students, faculty and staff separately — so those two
 * ask for a category. An External payee is outside the institution and has
 * none, and an organization is an entity rather than a person.
 */
const requiresBeneficiaryCategory = (
  beneficiaryType: AddPayeeBeneficiaryType,
  beneficiaryOrg: string,
): boolean =>
  beneficiaryType === 'individual' && (beneficiaryOrg === 'KSRCT' || beneficiaryOrg === 'KSREI');

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
  beneficiaryCategory: '',
  accountName: '',
  panNumber: '',
  accountNo: '',
  confirmAccountNo: '',
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

const sanitizeUppercaseAlphaNumeric = (value: unknown, maxLength: number): string =>
  normalizePayeeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength);

const extractPanFromGstin = (value: unknown): string => {
  const gstin = sanitizeUppercaseAlphaNumeric(value, 15);
  return gstin.length >= 12 ? gstin.slice(2, 12) : '';
};

const isExactUppercaseAlphaNumeric = (value: unknown, length: number): boolean =>
  new RegExp(`^[A-Z0-9]{${length}}$`).test(normalizePayeeText(value).toUpperCase());

const capitalizeFirstLetter = (value: unknown): string => {
  const text = normalizePayeeText(value);
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};
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
  // Light grey, and hidden while disabled, like every placeholder (index.css).
  placeholder: (base: any, state: any) => ({
    ...base,
    color: state.isDisabled ? 'transparent' : 'var(--placeholder-color)',
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
  const [organizationData, setOrganizationData] =
    useState<OrganizationDraft>(emptyOrganizationData);
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newBeneficiaryCategory, setNewBeneficiaryCategory] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newPanNumber, setNewPanNumber] = useState('');
  const [newAccountNo, setNewAccountNo] = useState('');
  const [newConfirmAccountNo, setNewConfirmAccountNo] = useState('');
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
    setNewBeneficiaryCategory('');
    setNewAccountName('');
    setNewPanNumber('');
    setNewAccountNo('');
    setNewConfirmAccountNo('');
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
        beneficiaryCategory: newBeneficiaryCategory,
        accountName: newAccountName,
        panNumber: newPanNumber,
        accountNo: newAccountNo,
        confirmAccountNo: newConfirmAccountNo,
        accountType: newAccountType,
        bankName: newBankName,
        branchName: newBranchName,
        ifsc: newIfsc,
      });
      return;
    }

    setOrganizationData({
      payeeName: newPayeeName,
      // The Organization tab never offers a category, so nothing to carry.
      beneficiaryCategory: '',
      accountName: newAccountName,
      organizationType: orgType,
      msme: msmeValue,
      gstin: gstinValue,
      panNumber: orgPanNumber,
      tdsDetails: tdsValue,
      tdsSection: tdsSectionValue,
      accountNo: newAccountNo,
      confirmAccountNo: newConfirmAccountNo,
      accountType: newAccountType,
      bankName: newBankName,
      branchName: newBranchName,
      ifsc: newIfsc,
    });
  };

  const loadDataForType = (type: AddPayeeBeneficiaryType) => {
    const data = type === 'individual' ? individualData : organizationData;
    setNewPayeeName(data.payeeName);
    setNewBeneficiaryCategory(data.beneficiaryCategory);
    setNewAccountName(data.accountName);
    setNewPanNumber(data.panNumber);
    setNewAccountNo(data.accountNo);
    setNewConfirmAccountNo(data.confirmAccountNo);
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
    const confirmAccountNo = normalizePayeeText(newConfirmAccountNo);
    const bankName = normalizePayeeText(newBankName);
    const branchName = capitalizeFirstLetter(newBranchName);
    const ifsc = sanitizeUppercaseAlphaNumeric(newIfsc, 11);
    const beneficiary = normalizePayeeText(newPayeeName);
    const beneficiaryCategory = normalizePayeeText(newBeneficiaryCategory);
    const categoryRequired = requiresBeneficiaryCategory(beneficiaryType, beneficiary);
    const accountName = normalizePayeeText(newAccountName).toUpperCase();
    const panNumber = sanitizeUppercaseAlphaNumeric(newPanNumber, 10);
    const orgPan = sanitizeUppercaseAlphaNumeric(
      orgPanNumber || extractPanFromGstin(gstinValue),
      10,
    );
    const organizationType = normalizePayeeText(orgType);
    const msme = normalizePayeeText(msmeValue);
    const gstin = sanitizeUppercaseAlphaNumeric(gstinValue, 15);
    const tdsDetails = normalizePayeeText(tdsValue);
    const tdsSection = normalizePayeeText(tdsSectionValue);
    const accountType = normalizePayeeText(newAccountType);

    const missingFields: string[] = [];

    if (!beneficiary) missingFields.push('Beneficiary');
    if (categoryRequired && !beneficiaryCategory) missingFields.push('Category');
    if (!accountName) missingFields.push('Account Name');
    if (beneficiaryType === 'individual') {
      if (!panNumber) missingFields.push('PAN Number');
      else if (!isExactUppercaseAlphaNumeric(panNumber, 10))
        missingFields.push('PAN Number (must be exactly 10 uppercase alphanumeric characters)');
    } else {
      if (!organizationType) missingFields.push('Organization Type');
      if (!msme) missingFields.push('MSME');
      if (!gstin) missingFields.push('GSTIN');
      if (!orgPan) missingFields.push('PAN Number');
      else if (!isExactUppercaseAlphaNumeric(orgPan, 10))
        missingFields.push('PAN Number (must be exactly 10 uppercase alphanumeric characters)');
      if (!tdsDetails) missingFields.push('TDS Details');
      if (tdsDetails === 'Yes' && !tdsSection) missingFields.push('TDS Section');
    }

    if (!accountNo) missingFields.push('Account Number');
    if (!confirmAccountNo) missingFields.push('Re-enter Account Number');
    if (!accountType) missingFields.push('Account Type');
    if (!bankName) missingFields.push('Bank Name');
    if (!branchName) missingFields.push('Branch Name');
    if (!ifsc) missingFields.push('IFSC Code');
    else if (!isExactUppercaseAlphaNumeric(ifsc, 11))
      missingFields.push('IFSC Code (must be exactly 11 uppercase alphanumeric characters)');

    if (missingFields.length > 0) {
      showAlert?.(`Please fill all mandatory fields: ${missingFields.join(', ')}`, 'warning');
      return;
    }

    if (accountNo !== confirmAccountNo) {
      showAlert?.('Account number and re-enter account number must match', 'warning');
      return;
    }

    await onAddPayee({
      id: createPayeeId(),
      payeeName: canonicalPayeeName,
      accountName,
      bankName,
      accountNo,
      ifsc,
      branchName,
      url: '',
      amount: '',
      mode: '',
      accountType,
      beneficiaryType,
      beneficiaryOrg: resolveCanonicalBeneficiaryOrg('', newPayeeName),
      beneficiaryCategory: categoryRequired ? beneficiaryCategory : '',
      ...(beneficiaryType === 'individual' && { panNumber }),
      ...(beneficiaryType === 'organization' && {
        organizationType,
        msme,
        gstin,
        panNumber: orgPan,
        tdsDetails,
        tdsSection: tdsDetails === 'Yes' ? tdsSection : '',
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
      <div
        className="add-payee-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
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
                <label>Beneficiary *</label>
                <div className="add-payee-modal-radio-group">
                  {BENEFICIARY_ORG_OPTIONS.map((option) => (
                    <label key={option} className="add-payee-modal-radio">
                      <input
                        type="radio"
                        name="beneficiaryInd"
                        value={option}
                        checked={newPayeeName === option}
                        onChange={() => {
                          setNewPayeeName(option);
                          // Moving to External drops the category rather than
                          // keeping one that no longer applies — it would sit
                          // there unseen and still reach the payload.
                          if (!requiresBeneficiaryCategory('individual', option)) {
                            setNewBeneficiaryCategory('');
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              {requiresBeneficiaryCategory('individual', newPayeeName) && (
                <div className="add-payee-modal-row">
                  <label>Category *</label>
                  <div className="add-payee-modal-radio-group">
                    {BENEFICIARY_CATEGORY_OPTIONS.map((option) => (
                      <label key={option} className="add-payee-modal-radio">
                        <input
                          type="radio"
                          name="beneficiaryCategoryInd"
                          value={option}
                          checked={newBeneficiaryCategory === option}
                          onChange={() => setNewBeneficiaryCategory(option)}
                          disabled={isSubmitting}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="add-payee-modal-row">
                <label>Account Name</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value.toUpperCase())}
                  placeholder="Enter Account name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>PAN Number</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newPanNumber}
                  onChange={(event) =>
                    setNewPanNumber(sanitizeUppercaseAlphaNumeric(event.target.value, 10))
                  }
                  placeholder="Enter PAN number"
                  maxLength={10}
                  minLength={10}
                  pattern="[A-Z0-9]{10}"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {beneficiaryType === 'organization' && (
            <div className="add-payee-modal-section">
              <div className="add-payee-modal-row">
                <label>Beneficiary *</label>
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
                <label>Account Name</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={newAccountName}
                  onChange={(event) => setNewAccountName(event.target.value.toUpperCase())}
                  placeholder="Enter Account name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>Organization Type</label>
                <CustomDropdown
                  className="organization-type-dropdown"
                  options={ORGANIZATION_TYPE_OPTIONS.map((option) => ({
                    value: option,
                    label: option,
                  }))}
                  value={orgType ? { value: orgType, label: orgType } : null}
                  onChange={(option) => {
                    const selected = option as OptionType | null;
                    setOrgType(selected?.value ? String(selected.value) : '');
                  }}
                  placeholder="Select Organization Type"
                  isDisabled={isSubmitting}
                  styles={{
                    ...dropdownBaseStyles,
                    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                  }}
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
                  onChange={(event) => {
                    const gstin = sanitizeUppercaseAlphaNumeric(event.target.value, 15);
                    setGstinValue(gstin);
                    const extractedPan = extractPanFromGstin(gstin);
                    if (extractedPan) setOrgPanNumber(extractedPan);
                  }}
                  placeholder="Enter GSTIN"
                  maxLength={15}
                  disabled={isSubmitting}
                />
              </div>
              <div className="add-payee-modal-row">
                <label>PAN Number</label>
                <input
                  className="payee-modal-field-input"
                  type="text"
                  value={orgPanNumber}
                  onChange={(event) =>
                    setOrgPanNumber(sanitizeUppercaseAlphaNumeric(event.target.value, 10))
                  }
                  placeholder="Enter PAN number"
                  maxLength={10}
                  minLength={10}
                  pattern="[A-Z0-9]{10}"
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
                  <div
                    className={`add-payee-modal-tds-section ${tdsValue === 'Yes' ? 'visible' : ''}`}
                  >
                    <CustomDropdown
                      className="tds-section-dropdown"
                      options={TDS_SECTION_OPTIONS.map((option) => ({
                        value: option,
                        label: option,
                      }))}
                      value={
                        tdsSectionValue ? { value: tdsSectionValue, label: tdsSectionValue } : null
                      }
                      onChange={(option) => {
                        const selected = option as OptionType | null;
                        setTdsSectionValue(selected?.value ? String(selected.value) : '');
                      }}
                      placeholder="Select TDS Section"
                      isDisabled={isSubmitting || tdsValue !== 'Yes'}
                      styles={{
                        ...dropdownBaseStyles,
                        container: (base: any) => ({ ...base, width: '100%', flex: 1 }),
                      }}
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
                inputMode="numeric"
                disabled={isSubmitting}
              />
            </div>
            <div className="add-payee-modal-row">
              <label>Re-enter Account No</label>
              <div className="payee-modal-confirm-field">
                <input
                  className={`payee-modal-field-input ${newConfirmAccountNo && newAccountNo && newConfirmAccountNo !== newAccountNo ? 'is-invalid' : ''}`}
                  type="password"
                  value={newConfirmAccountNo}
                  onChange={(event) => setNewConfirmAccountNo(event.target.value)}
                  onPaste={(event) => event.preventDefault()}
                  onDrop={(event) => event.preventDefault()}
                  placeholder="Re-enter account number"
                  inputMode="numeric"
                  disabled={isSubmitting}
                />
                {newConfirmAccountNo && newAccountNo && newConfirmAccountNo === newAccountNo && (
                  <CheckCircle2 className="payee-modal-confirm-icon" size={18} aria-hidden="true" />
                )}
              </div>
            </div>
            {newConfirmAccountNo && newAccountNo && newConfirmAccountNo !== newAccountNo && (
              <div className="add-payee-modal-row add-payee-modal-row--helper">
                <span className="add-payee-modal-helper-text add-payee-modal-helper-text--error">
                  Account numbers do not match
                </span>
              </div>
            )}
            <div className="add-payee-modal-row">
              <label>Account Type *</label>
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
                onChange={(event) => setNewBranchName(capitalizeFirstLetter(event.target.value))}
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
                onChange={(event) =>
                  setNewIfsc(sanitizeUppercaseAlphaNumeric(event.target.value, 11))
                }
                placeholder="Enter IFSC code"
                maxLength={11}
                minLength={11}
                pattern="[A-Z0-9]{11}"
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
