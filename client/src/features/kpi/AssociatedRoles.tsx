import { Info, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import CustomInput from '../../shared/components/ui/CustomInput';
import CustomModal from '../../shared/components/ui/CustomModal';
import CustomTagInput from '../../shared/components/ui/CustomTagInput';
import './AssociatedRoles.css';
import { useAssociatedLevels } from './useAssociatedLevels';

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
}: {
  level: string;
  sectionId: string;
  ratings: { priority: number; frequency: number; workload: number };
  onRatingChange: (field: 'priority' | 'frequency' | 'workload', value: number) => void;
}) => (
  <section
    className="associated-roles-credit-section"
    aria-labelledby={`${sectionId}-credit-points-title`}
  >
    <h2 id={`${sectionId}-credit-points-title`}>Credit Points</h2>
    <div className="associated-roles-credit-card">
      <label className="associated-roles-credit-level">
        <FieldLabel>Level</FieldLabel>
        <input value={level} readOnly />
      </label>
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
      <label>
        <FieldLabel> Max</FieldLabel>
        <input className="associated-roles-number" value="" placeholder="—" readOnly />
      </label>
      <label>
        <FieldLabel>Score</FieldLabel>
        <input className="associated-roles-number" value="" placeholder="—" readOnly />
      </label>
      <label>
        <FieldLabel>Credit Point</FieldLabel>
        <input className="associated-roles-credit-value" value="" placeholder="—" readOnly />
      </label>
    </div>
  </section>
);

const AssociatedLevelsTable = ({ onAddDetails }: { onAddDetails: () => void }) => {
  const associatedLevelRows: Array<{
    role: string;
    il1: string;
    il2: string;
    dl1: string;
    dl2: string;
  }> = [];

  return (
    <section
      className="associated-roles-table-section"
      aria-labelledby="associated-levels-table-title"
    >
      <h2 id="associated-levels-table-title">Associated Roles</h2>
      <div className="associated-roles-table-wrap">
        <table className="associated-roles-table">
          <thead>
            <tr>
              <th rowSpan={2}>S.No.</th>
              <th rowSpan={2}>Associated Roles</th>
              <th colSpan={4}>Credit Points</th>
              <th rowSpan={2}>Action</th>
            </tr>
            <tr>
              <th>I-L1</th>
              <th>I-L2</th>
              <th>D-L1</th>
              <th>D-L2</th>
            </tr>
          </thead>
          <tbody>
            {associatedLevelRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="associated-roles-table-empty-row">
                  <div className="associated-roles-table-empty-content">
                    <button
                      type="button"
                      className="associated-roles-table-add-inline"
                      onClick={onAddDetails}
                    >
                      <Plus size={14} strokeWidth={3} />
                      Add Associated Role
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              associatedLevelRows.map((associatedRole, index) => (
                <tr key={associatedRole.role}>
                  <td>{index + 1}</td>
                  <td>{associatedRole.role}</td>
                  <td>{associatedRole.il1}</td>
                  <td>{associatedRole.il2}</td>
                  <td>{associatedRole.dl1}</td>
                  <td>{associatedRole.dl2}</td>
                  <td>
                    <div className="associated-roles-table-actions">
                      <button
                        type="button"
                        aria-label={`Add details for ${associatedRole.role}`}
                        onClick={() => onAddDetails()}
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                      <button type="button" aria-label={`Edit ${associatedRole.role}`}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${associatedRole.role}`}
                        className="is-delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
  // First use props, then fall back to route state, then use defaults
  const roleValue = associatedRole || routeState?.associatedRole || '';
  const primaryRoleValue = primaryRole || routeState?.primaryRole || '';
  const [responsibilities, setResponsibilities] = useState<{
    [level: string]: { id: string; text: string }[];
  }>({});
  const [ratings, setRatings] = useState<{
    [level: string]: { priority: number; frequency: number; workload: number };
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

  return (
    <section className="associated-roles-page" aria-labelledby="associated-role-details-title">
      <div className="associated-roles-panel">
        <header className="associated-roles-heading associated-roles-primary-heading">
          <h1 id="associated-role-details-title">Associated Roles</h1>
        </header>

        <div className="associated-roles-detail-top-row">
          <div className="associated-roles-role-field">
            <FieldLabel>Role</FieldLabel>
            <input value={roleValue} readOnly aria-label="Role" />
          </div>
          <div className="associated-roles-role-field">
            <FieldLabel>Primary Role</FieldLabel>
            <input value={primaryRoleValue} readOnly aria-label="Primary Role" />
          </div>
          <div className="associated-roles-levels">
            <FieldLabel>Level</FieldLabel>
            <label>
              <input
                type="checkbox"
                checked={isInstitutionalChecked}
                onChange={(event) => handleInstitutionalLevelChange(event.target.checked)}
              />
              Institutional Level
            </label>
            <label>
              <input
                type="checkbox"
                checked={isDepartmentChecked}
                onChange={(event) => handleDepartmentLevelChange(event.target.checked)}
              />
              Department Level
            </label>
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
                    <input
                      type="text"
                      value={inputValues[associatedLevel] || ''}
                      onChange={(e) =>
                        setInputValues((current) => ({
                          ...current,
                          [associatedLevel]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddResponsibility(associatedLevel);
                        }
                      }}
                      placeholder="Enter responsibility"
                      aria-label={`${associatedLevel} Responsibilities`}
                    />
                    <button
                      type="button"
                      className="associated-roles-responsibility-add"
                      onClick={() => handleAddResponsibility(associatedLevel)}
                      aria-label={`Add ${associatedLevel} responsibilities`}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      className="associated-roles-responsibility-edit"
                      aria-label={`Edit ${associatedLevel} responsibilities`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="associated-roles-responsibility-delete"
                      aria-label={`Delete ${associatedLevel} responsibilities`}
                    >
                      <Trash2 size={16} />
                    </button>
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
            <button type="button" className="associated-roles-modal-cancel" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className="associated-roles-modal-save"
              onClick={saveResponsibility}
              disabled={!modalState.text.trim()}
            >
              Save
            </button>
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
    }
  }, [location.state, resetAssociatedLevels]);

  const handleAddAssociatedLevel = () => {
    navigate('/kpi/associated-add', {
      state: {
        associatedRole: role,
        primaryRole: role,
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
            <FieldLabel>Role</FieldLabel>
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              aria-label="Role"
            />
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
            <label>
              <input
                type="checkbox"
                checked={isInstitutionalChecked}
                onChange={(event) => handleInstitutionalLevelChange(event.target.checked)}
              />
              Institutional Level
            </label>
            <label>
              <input
                type="checkbox"
                checked={isDepartmentChecked}
                onChange={(event) => handleDepartmentLevelChange(event.target.checked)}
              />
              Department Level
            </label>
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
          />
        ))}

        <AssociatedLevelsTable onAddDetails={handleAddAssociatedLevel} />

        <div className="associated-roles-action-footer">
          <button
            type="button"
            className="associated-roles-save-button"
            disabled
            title="Persistence is not available yet"
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
};

export default AssociatedRoles;
export { AssociatedRoleDetailsPage };
