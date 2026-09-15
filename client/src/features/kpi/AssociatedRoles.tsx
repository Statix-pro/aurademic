import { Info, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAssociatedLevels } from './useAssociatedLevels';
import CustomButton from '../../shared/components/ui/CustomButton';
import CustomCheckbox from '../../shared/components/ui/CustomCheckbox';
import CustomInput from '../../shared/components/ui/CustomInput';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTable from '../../shared/components/ui/CustomTable';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import './AssociatedRoles.css';

type CreditPointValues = {
  max: string;
  score: string;
  creditPoint: string;
};

const StarRating = ({
  filled,
  onChange,
}: {
  filled: number;
  onChange: (value: number) => void;
}) => {
  return (
    <div
      className="associated-roles-stars"
      role="group"
      aria-label={`${filled} out of 5 stars selected`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= filled ? 'is-filled' : 'is-empty'}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          aria-pressed={star <= filled}
          onClick={() => onChange(filled === star ? 0 : star)}
        >
          <Star size={22} fill={star <= filled ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
};

const FieldLabel = ({ children, hint }: { children: string; hint?: string }) => (
  <span className="associated-roles-field-label">
    {children}
    {hint && (
      <span
        className="associated-roles-info-tooltip"
        data-tooltip={hint}
        tabIndex={0}
        aria-label={`${children}: ${hint}`}
      >
        <Info size={14} aria-hidden="true" />
      </span>
    )}
  </span>
);

const AssociatedLevelCreditPoints = ({
  level,
  sectionId,
  ratings,
  onRatingChange,
  creditPointValues,
  onCreditPointChange,
}: {
  level: string;
  sectionId: string;
  ratings: { priority: number; frequency: number; workload: number };
  onRatingChange: (field: 'priority' | 'frequency' | 'workload', value: number) => void;
  creditPointValues: CreditPointValues;
  onCreditPointChange: (field: keyof CreditPointValues, value: string) => void;
}) => (
  <section
    className="associated-roles-credit-section"
    aria-labelledby={`${sectionId}-credit-points-title`}
  >
    <h2 id={`${sectionId}-credit-points-title`}>Credit Points</h2>
    <div className="associated-roles-credit-card">
      <CustomInput
        name={`${sectionId}-level`}
        label="Level"
        value={level}
        onChange={() => undefined}
        readOnly
        className="associated-roles-credit-level"
      />
      <div>
        <FieldLabel hint="Shows how important this role is compared with the other associated levels.">
          Priority
        </FieldLabel>
        <StarRating
          filled={ratings.priority}
          onChange={(value) => onRatingChange('priority', value)}
        />
      </div>
      <div>
        <FieldLabel hint="Shows how often the responsibilities for this role are carried out.">
          Frequency
        </FieldLabel>
        <StarRating
          filled={ratings.frequency}
          onChange={(value) => onRatingChange('frequency', value)}
        />
      </div>
      <div>
        <FieldLabel hint="Shows the expected effort and time required for this role.">
          Work Load
        </FieldLabel>
        <StarRating
          filled={ratings.workload}
          onChange={(value) => onRatingChange('workload', value)}
        />
      </div>
      <CustomInput
        name={`${sectionId}-max`}
        label="Max"
        type="number"
        value={creditPointValues.max}
        onChange={(value) => onCreditPointChange('max', value)}
        className="associated-roles-number"
      />
      <CustomInput
        name={`${sectionId}-score`}
        label="Score"
        type="number"
        value={creditPointValues.score}
        onChange={(value) => onCreditPointChange('score', value)}
        className="associated-roles-number"
      />
      <CustomInput
        name={`${sectionId}-credit-point`}
        label="Credit Point"
        type="number"
        value={creditPointValues.creditPoint}
        onChange={(value) => onCreditPointChange('creditPoint', value)}
        className="associated-roles-credit-value"
      />
    </div>
  </section>
);

const AssociatedLevelsTable = ({ onAddDetails }: { onAddDetails: () => void }) => {
  const associatedLevelRows: Array<{
    serialNumber: number;
    role: string;
    il1: string;
    il2: string;
    dl1: string;
    dl2: string;
  }> = [];
  const columns = [
    { key: 'serialNumber', label: 'S.No.' },
    { key: 'role', label: 'Associated Roles' },
    { key: 'il1', label: 'I-L1' },
    { key: 'il2', label: 'I-L2' },
    { key: 'dl1', label: 'D-L1' },
    { key: 'dl2', label: 'D-L2' },
  ];

  return (
    <section
      className="associated-roles-table-section"
      aria-labelledby="associated-levels-table-title"
    >
      <div className="associated-roles-table-heading-row">
        <h2 id="associated-levels-table-title">Associated Roles</h2>
        <CustomButton
          variant="primary"
          className="associated-roles-table-add-inline"
          onClick={onAddDetails}
        >
          <Plus size={14} strokeWidth={3} aria-hidden="true" />
          Add Associated Role
        </CustomButton>
      </div>
      <div className="associated-roles-table-wrap">
        <CustomTable
          columns={columns}
          data={associatedLevelRows}
          keyField="serialNumber"
          className="associated-roles-table"
          emptyMessage="No associated roles configured."
        />
      </div>
    </section>
  );
};

const AssociatedRoleDetailsPage = ({
  associatedRole,
  primaryRole,
}: {
  associatedRole?: string;
  primaryRole?: string;
}) => {
  const location = useLocation();
  const routeState = location.state as { associatedRole?: string; primaryRole?: string } | null;
  const [roleValue, setRoleValue] = useState(associatedRole || routeState?.associatedRole || '');
  const [primaryRoleValue, setPrimaryRoleValue] = useState(
    primaryRole || routeState?.primaryRole || '',
  );
  const [responsibilities, setResponsibilities] = useState<{
    [level: string]: { id: string; text: string }[];
  }>({});
  const [ratings, setRatings] = useState<{
    [level: string]: { priority: number; frequency: number; workload: number };
  }>({});
  const [creditPointValues, setCreditPointValues] = useState<{
    [level: string]: CreditPointValues;
  }>({});
  const {
    selectedAssociatedLevels,
    isInstitutionalChecked,
    isDepartmentChecked,
    getAvailableLevelOptions,
    handleLevelSelect,
    removeAssociatedLevel,
    handleInstitutionalLevelChange,
    handleDepartmentLevelChange,
  } = useAssociatedLevels({
    onLevelsRemoved: (levels) => {
      setResponsibilities((current) => {
        const updated = { ...current };
        levels.forEach((level) => delete updated[level]);
        return updated;
      });
      setRatings((current) => {
        const updated = { ...current };
        levels.forEach((level) => delete updated[level]);
        return updated;
      });
      setCreditPointValues((current) => {
        const updated = { ...current };
        levels.forEach((level) => delete updated[level]);
        return updated;
      });
    },
  });
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    level: string;
    mode: 'add' | 'edit';
    id?: string;
    text: string;
  }>({
    isOpen: false,
    level: '',
    mode: 'add',
    text: '',
  });
  const [inputValues, setInputValues] = useState<{ [level: string]: string }>({});

  const openEditModal = (level: string, id: string, text: string) => {
    setModalState({ isOpen: true, level, mode: 'edit', id, text });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, level: '', mode: 'add', text: '' });
  };

  const handleAddResponsibility = (level: string) => {
    const text = inputValues[level]?.trim();
    if (!text) return;

    setResponsibilities((current) => {
      const levelResponsibilities = current[level] || [];
      return {
        ...current,
        [level]: [...levelResponsibilities, { id: crypto.randomUUID(), text }],
      };
    });
    setInputValues((current) => ({ ...current, [level]: '' }));
  };

  const saveResponsibility = () => {
    const { level, mode, text, id } = modalState;
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setResponsibilities((current) => {
      const levelResponsibilities = current[level] || [];
      if (mode === 'add') {
        return {
          ...current,
          [level]: [...levelResponsibilities, { id: crypto.randomUUID(), text: trimmedText }],
        };
      } else if (mode === 'edit' && id) {
        return {
          ...current,
          [level]: levelResponsibilities.map((item) =>
            item.id === id ? { ...item, text: trimmedText } : item,
          ),
        };
      }
      return current;
    });
    closeModal();
  };

  const deleteResponsibility = (level: string, id: string) => {
    setResponsibilities((current) => ({
      ...current,
      [level]: (current[level] || []).filter((item) => item.id !== id),
    }));
  };

  const editLatestResponsibility = (level: string) => {
    const levelResponsibilities = responsibilities[level] || [];
    const latestResponsibility = levelResponsibilities[levelResponsibilities.length - 1];
    if (latestResponsibility) {
      openEditModal(level, latestResponsibility.id, latestResponsibility.text);
    }
  };

  const deleteLatestResponsibility = (level: string) => {
    const levelResponsibilities = responsibilities[level] || [];
    const latestResponsibility = levelResponsibilities[levelResponsibilities.length - 1];
    if (latestResponsibility) {
      deleteResponsibility(level, latestResponsibility.id);
    }
  };

  const updateRating = (
    level: string,
    field: 'priority' | 'frequency' | 'workload',
    value: number,
  ) => {
    setRatings((current) => ({
      ...current,
      [level]: { priority: 0, frequency: 0, workload: 0, ...current[level], [field]: value },
    }));
  };

  const updateCreditPoint = (level: string, field: keyof CreditPointValues, value: string) => {
    setCreditPointValues((current) => ({
      ...current,
      [level]: { max: '', score: '', creditPoint: '', ...current[level], [field]: value },
    }));
  };

  return (
    <section className="associated-roles-page" aria-labelledby="associated-role-details-title">
      <div className="associated-roles-panel">
        <header className="associated-roles-heading associated-roles-primary-heading">
          <h1 id="associated-role-details-title">Associated Roles</h1>
        </header>

        <div className="associated-roles-detail-top-row">
          <CustomInput
            name="associated-role"
            label="Role"
            value={roleValue}
            onChange={setRoleValue}
            className="associated-roles-role-field"
          />
          <CustomInput
            name="primary-role"
            label="Primary Role"
            value={primaryRoleValue}
            onChange={setPrimaryRoleValue}
            className="associated-roles-role-field"
          />
          <div className="associated-roles-levels">
            <FieldLabel>Level</FieldLabel>
            <CustomCheckbox
              name="detail-institutional-level"
              label="Institutional Level"
              checked={isInstitutionalChecked}
              onChange={handleInstitutionalLevelChange}
              className="associated-roles-round-checkbox"
            />
            <CustomCheckbox
              name="detail-department-level"
              label="Department Level"
              checked={isDepartmentChecked}
              onChange={handleDepartmentLevelChange}
              className="associated-roles-round-checkbox"
            />
          </div>
        </div>

        <div className="associated-roles-associated-levels">
          <FieldLabel>Associated Levels</FieldLabel>
          <CustomTagInput
            name="associated-levels-details"
            value={selectedAssociatedLevels}
            onChange={(levels) => {
              const nextLevel = levels.find((level) => !selectedAssociatedLevels.includes(level));
              const removedLevel = selectedAssociatedLevels.find(
                (level) => !levels.includes(level),
              );
              if (nextLevel) handleLevelSelect(nextLevel);
              if (removedLevel) removeAssociatedLevel(removedLevel);
            }}
            suggestions={getAvailableLevelOptions()}
            placeholder={
              isInstitutionalChecked || isDepartmentChecked
                ? 'Select a level to add'
                : 'Select a level above.'
            }
            disabled={!isInstitutionalChecked && !isDepartmentChecked}
          />
        </div>

        {selectedAssociatedLevels.map((associatedLevel) => (
          <div className="associated-roles-detail-level" key={associatedLevel}>
            <div className="associated-roles-credit-responsibility-card">
              <AssociatedLevelCreditPoints
                level={associatedLevel}
                sectionId={`detail-${associatedLevel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                ratings={ratings[associatedLevel] || { priority: 0, frequency: 0, workload: 0 }}
                onRatingChange={(field, value) => updateRating(associatedLevel, field, value)}
                creditPointValues={
                  creditPointValues[associatedLevel] || {
                    max: '',
                    score: '',
                    creditPoint: '',
                  }
                }
                onCreditPointChange={(field, value) =>
                  updateCreditPoint(associatedLevel, field, value)
                }
              />
              <div className="associated-roles-responsibilities">
                <FieldLabel>{`${associatedLevel} Responsibilities`}</FieldLabel>
                <div className="associated-roles-responsibilities-card">
                  {(responsibilities[associatedLevel] || []).length > 0 && (
                    <div className="associated-roles-responsibility-list">
                      {(responsibilities[associatedLevel] || []).map((item) => (
                        <div key={item.id} className="associated-roles-responsibility-item">
                          <span className="associated-roles-responsibility-text">{item.text}</span>
                          <div className="associated-roles-responsibility-item-actions">
                            <button
                              type="button"
                              className="associated-roles-responsibility-edit"
                              onClick={() => openEditModal(associatedLevel, item.id, item.text)}
                              aria-label={`Edit responsibility: ${item.text}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="associated-roles-responsibility-delete"
                              onClick={() => deleteResponsibility(associatedLevel, item.id)}
                              aria-label={`Delete responsibility: ${item.text}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="associated-roles-responsibility-input-row">
                    <CustomInput
                      name={`${associatedLevel}-responsibility`}
                      value={inputValues[associatedLevel] || ''}
                      onChange={(value) =>
                        setInputValues((current) => ({
                          ...current,
                          [associatedLevel]: value,
                        }))
                      }
                      placeholder="Enter responsibility"
                      className="associated-roles-responsibility-input"
                    />
                    <CustomButton
                      variant="outline-primary"
                      className="associated-roles-responsibility-add"
                      onClick={() => handleAddResponsibility(associatedLevel)}
                      aria-label={`Add ${associatedLevel} responsibilities`}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </CustomButton>
                    <CustomButton
                      variant="outline-primary"
                      className="associated-roles-responsibility-edit"
                      onClick={() => editLatestResponsibility(associatedLevel)}
                      disabled={(responsibilities[associatedLevel] || []).length === 0}
                      aria-label={`Edit the latest ${associatedLevel} responsibility`}
                      title="Edit the latest responsibility"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </CustomButton>
                    <CustomButton
                      variant="outline-danger"
                      className="associated-roles-responsibility-delete"
                      onClick={() => deleteLatestResponsibility(associatedLevel)}
                      disabled={(responsibilities[associatedLevel] || []).length === 0}
                      aria-label={`Delete the latest ${associatedLevel} responsibility`}
                      title="Delete the latest responsibility"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </CustomButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <CustomModal
          show={modalState.isOpen}
          onHide={closeModal}
          title="Edit Responsibility"
          size="sm"
        >
          <CustomInput
            name="responsibility-text"
            value={modalState.text}
            onChange={(value) => setModalState((current) => ({ ...current, text: value }))}
            placeholder="Enter responsibility"
            autoFocus
          />
          <div className="d-flex justify-content-end gap-2">
            <CustomButton
              variant="secondary"
              className="associated-roles-modal-cancel"
              onClick={closeModal}
            >
              Cancel
            </CustomButton>
            <CustomButton
              variant="primary"
              className="associated-roles-modal-save"
              onClick={saveResponsibility}
              disabled={!modalState.text.trim()}
            >
              Save
            </CustomButton>
          </div>
        </CustomModal>
      </div>
    </section>
  );
};

const AssociatedRoles = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [category, setCategory] = useState<'Academic' | 'Non-Academic'>('Academic');
  const [role, setRole] = useState('');
  const [ratings, setRatings] = useState<{
    [level: string]: { priority: number; frequency: number; workload: number };
  }>({});
  const [creditPointValues, setCreditPointValues] = useState<{
    [level: string]: CreditPointValues;
  }>({});
  const {
    selectedAssociatedLevels,
    isInstitutionalChecked,
    isDepartmentChecked,
    getAvailableLevelOptions,
    handleLevelSelect,
    removeAssociatedLevel,
    handleInstitutionalLevelChange,
    handleDepartmentLevelChange,
    reset: resetAssociatedLevels,
  } = useAssociatedLevels();

  useEffect(() => {
    const shouldResetForm = (location.state as { resetForm?: boolean } | null)?.resetForm;

    if (shouldResetForm) {
      setRole('');
      setCategory('Academic');
      resetAssociatedLevels();
      setRatings({});
      setCreditPointValues({});
    }
  }, [location.state, resetAssociatedLevels]);

  const handleAddAssociatedLevel = () => {
    navigate('/kpi/associated-add', {
      state: {
        primaryRole: role.trim(),
      },
    });
  };

  return (
    <section className="associated-roles-page" aria-labelledby="associated-roles-title">
      <div className="associated-roles-panel">
        <header className="associated-roles-heading associated-roles-primary-heading">
          <h1 id="associated-roles-title">Primary Role</h1>
        </header>

        <div className="associated-roles-top-row">
          <div className="associated-roles-role-field">
            <CustomInput name="primary-role" label="Role" value={role} onChange={setRole} />
          </div>
          <div className="associated-roles-category" aria-label="Category">
            <FieldLabel>Category</FieldLabel>
            <div className="associated-roles-category-actions">
              {(['Academic', 'Non-Academic'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={category === option ? 'is-selected' : ''}
                  aria-pressed={category === option}
                  onClick={() => setCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="associated-roles-levels">
            <FieldLabel>Level</FieldLabel>
            <CustomCheckbox
              name="institutional-level"
              label="Institutional Level"
              checked={isInstitutionalChecked}
              onChange={handleInstitutionalLevelChange}
              className="associated-roles-round-checkbox"
            />
            <CustomCheckbox
              name="department-level"
              label="Department Level"
              checked={isDepartmentChecked}
              onChange={handleDepartmentLevelChange}
              className="associated-roles-round-checkbox"
            />
          </div>
        </div>

        <div className="associated-roles-associated-levels">
          <FieldLabel>Associated Levels</FieldLabel>
          <CustomTagInput
            name="associated-levels"
            value={selectedAssociatedLevels}
            onChange={(levels) => {
              const nextLevel = levels.find((level) => !selectedAssociatedLevels.includes(level));
              const removedLevel = selectedAssociatedLevels.find(
                (level) => !levels.includes(level),
              );
              if (nextLevel) handleLevelSelect(nextLevel);
              if (removedLevel) removeAssociatedLevel(removedLevel);
            }}
            suggestions={getAvailableLevelOptions()}
            placeholder={
              isInstitutionalChecked || isDepartmentChecked
                ? 'Select a level to add'
                : 'Select a level above.'
            }
            disabled={!isInstitutionalChecked && !isDepartmentChecked}
          />
        </div>

        {selectedAssociatedLevels.map((associatedLevel) => (
          <AssociatedLevelCreditPoints
            key={associatedLevel}
            level={associatedLevel}
            sectionId={associatedLevel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            ratings={ratings[associatedLevel] || { priority: 0, frequency: 0, workload: 0 }}
            onRatingChange={(field, value) =>
              setRatings((current) => ({
                ...current,
                [associatedLevel]: {
                  priority: 0,
                  frequency: 0,
                  workload: 0,
                  ...current[associatedLevel],
                  [field]: value,
                },
              }))
            }
            creditPointValues={
              creditPointValues[associatedLevel] || {
                max: '',
                score: '',
                creditPoint: '',
              }
            }
            onCreditPointChange={(field, value) =>
              setCreditPointValues((current) => ({
                ...current,
                [associatedLevel]: {
                  max: '',
                  score: '',
                  creditPoint: '',
                  ...current[associatedLevel],
                  [field]: value,
                },
              }))
            }
          />
        ))}

        <AssociatedLevelsTable onAddDetails={handleAddAssociatedLevel} />

        <div className="associated-roles-action-footer">
          <CustomButton
            variant="primary"
            className="associated-roles-save-button"
            disabled
            title="Persistence is not available yet"
          >
            Save
          </CustomButton>
        </div>
      </div>
    </section>
  );
};

export default AssociatedRoles;
export { AssociatedRoleDetailsPage };
