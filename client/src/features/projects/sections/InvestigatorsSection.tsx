import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { GripVertical } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import {
  DEFAULT_COUNTRY,
  HOST_ORGANIZATION_NAME,
  MAX_INVESTIGATORS,
  MEMBER_TYPE_OPTIONS,
} from '../constants';
import { createInvestigatorRow, moveItem, removeAt, replaceAt } from '../projectFormState';
import projectsApi from '../projectsApi';

import type {
  DepartmentOption,
  EmployeeSearchResult,
  InvestigatorRow,
  MemberType,
  ProjectFormState,
} from '../types';

interface InvestigatorsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  departments: DepartmentOption[];
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * Faculty rows are picked from the employee directory — that link is what puts
 * the project on the person's dashboard — so the name field searches instead of
 * accepting free text. Students and external members are typed in.
 */
const FacultyNameSearch: React.FC<{
  row: InvestigatorRow;
  onSelect: (result: EmployeeSearchResult) => void;
  onClear: () => void;
  disabled: boolean;
  invalid: boolean;
}> = ({ row, onSelect, onClear, disabled, invalid }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Debounced so typing a name does not fire a request per keystroke.
    const timer = setTimeout(async () => {
      try {
        setResults(await projectsApi.searchFaculty(query.trim()));
      } catch (error) {
        console.error('Faculty search failed', error);
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const selected = Boolean(row.identityCode);

  return (
    <div className="pf-search" ref={wrapperRef}>
      <input
        type="text"
        className={`pf-input ${invalid ? 'is-invalid' : ''}`.trim()}
        placeholder="Name (Searchable)"
        value={selected ? row.name : query}
        onChange={(event) => {
          if (selected) onClear();
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => !selected && setIsOpen(true)}
        disabled={disabled}
        aria-label="Faculty name"
      />

      {selected && !disabled && (
        <button type="button" className="pf-search__clear" onClick={onClear}>
          Change
        </button>
      )}

      {isOpen && !selected && results.length > 0 && (
        <ul className="pf-search__menu">
          {results.map((result) => (
            <li key={`${result.id}-${result.author_id}`}>
              <button
                type="button"
                className="pf-search__option"
                onClick={() => {
                  onSelect(result);
                  setIsOpen(false);
                  setQuery('');
                }}
              >
                <span className="pf-search__name">{result.name}</span>
                <span className="pf-search__meta">
                  {[result.author_id, result.department].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const InvestigatorsSection: React.FC<InvestigatorsSectionProps> = ({
  form,
  patch,
  departments,
  errors,
  disabled,
}) => {
  const rows = form.investigators;

  const departmentOptions = useMemo(
    () => departments.map((department) => ({ value: department.name, label: department.name })),
    [departments],
  );

  const update = (index: number, changes: Partial<InvestigatorRow>) =>
    patch({ investigators: replaceAt(rows, index, changes) });

  const changeMemberType = (index: number, memberType: MemberType) => {
    const wasPrincipal = rows[index].isPrincipal;

    // Switching type invalidates the identity and the auto-filled fields, so
    // the row restarts as a blank row of the new type.
    patch({
      investigators: replaceAt(rows, index, {
        ...createInvestigatorRow({ memberType }),
        key: rows[index].key,
        isPrincipal: wasPrincipal,
      }),
    });
  };

  const addRow = () => {
    if (rows.length >= MAX_INVESTIGATORS) return;
    patch({ investigators: [...rows, createInvestigatorRow()] });
  };

  const removeRow = (index: number) => {
    const next = removeAt(rows, index);
    // The PI must survive the removal of the row that held the flag.
    if (next.length > 0 && !next.some((row) => row.isPrincipal)) {
      next[0] = { ...next[0], isPrincipal: true };
    }
    patch({ investigators: next });
  };

  const setPrincipal = (index: number) =>
    patch({
      investigators: rows.map((row, position) => ({ ...row, isPrincipal: position === index })),
    });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    patch({ investigators: moveItem(rows, result.source.index, result.destination.index) });
  };

  return (
    <SectionCard
      title="Investigator(s)"
      error={errors.investigators}
      headerRight={
        <div className="pf-driven-by">
          <span className="pf-driven-by__label">Driven by</span>
          {(['faculty', 'student'] as const).map((option) => (
            <label className="pf-radio" key={option}>
              <input
                type="radio"
                name="drivenBy"
                value={option}
                checked={form.drivenBy === option}
                onChange={() => patch({ drivenBy: option })}
                disabled={disabled}
              />
              <span>{option === 'faculty' ? 'Faculty' : 'Student'}</span>
            </label>
          ))}
        </div>
      }
    >
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="investigators">
          {(droppable) => (
            <div ref={droppable.innerRef} {...droppable.droppableProps} className="pf-rows">
              {rows.map((row, index) => (
                <Draggable
                  key={row.key}
                  draggableId={row.key}
                  index={index}
                  isDragDisabled={disabled}
                >
                  {(draggable, snapshot) => (
                    <div
                      ref={draggable.innerRef}
                      {...draggable.draggableProps}
                      className={`pf-investigator-row pf-investigator-row--${row.memberType} ${snapshot.isDragging ? 'is-dragging' : ''}`.trim()}
                    >
                      <span
                        className="pf-drag-handle"
                        {...draggable.dragHandleProps}
                        aria-label="Reorder investigator"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} aria-hidden="true" />
                      </span>

                      <label className="pf-principal" title="Principal Investigator">
                        <input
                          type="radio"
                          name="principalInvestigator"
                          checked={row.isPrincipal}
                          onChange={() => setPrincipal(index)}
                          disabled={disabled}
                        />
                        <span className="pf-principal__tag">
                          {row.isPrincipal ? 'PI' : 'Co-PI'}
                        </span>
                      </label>

                      <SelectField
                        className="pf-investigator-row__type"
                        value={row.memberType}
                        onChange={(value) => changeMemberType(index, value as MemberType)}
                        options={MEMBER_TYPE_OPTIONS.map((option) => ({ ...option }))}
                        placeholder="Type"
                        disabled={disabled}
                        ariaLabel="Investigator type"
                      />

                      {row.memberType === 'faculty' ? (
                        <FacultyNameSearch
                          row={row}
                          disabled={disabled}
                          invalid={Boolean(
                            errors[`investigators[${index}].name`] ||
                            errors[`investigators[${index}].identity_code`],
                          )}
                          onSelect={(result) =>
                            update(index, {
                              identityCode: result.author_id ?? '',
                              name: result.name,
                              department: result.department ?? '',
                              organization: result.organization ?? HOST_ORGANIZATION_NAME,
                              country: result.country ?? DEFAULT_COUNTRY,
                              email: result.email ?? '',
                            })
                          }
                          onClear={() =>
                            update(index, {
                              identityCode: '',
                              name: '',
                              department: '',
                              email: '',
                            })
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          className={`pf-input ${errors[`investigators[${index}].name`] ? 'is-invalid' : ''}`.trim()}
                          placeholder="Name"
                          value={row.name}
                          onChange={(event) => update(index, { name: event.target.value })}
                          disabled={disabled}
                          aria-label="Investigator name"
                        />
                      )}

                      {row.memberType === 'external' ? (
                        <>
                          <input
                            type="text"
                            className={`pf-input ${errors[`investigators[${index}].organization`] ? 'is-invalid' : ''}`.trim()}
                            placeholder="Organization"
                            value={row.organization}
                            onChange={(event) =>
                              update(index, { organization: event.target.value })
                            }
                            disabled={disabled}
                            aria-label="Organization"
                          />
                          <input
                            type="text"
                            className="pf-input pf-investigator-row__country"
                            placeholder="Country"
                            value={row.country}
                            onChange={(event) => update(index, { country: event.target.value })}
                            disabled={disabled}
                            aria-label="Country"
                          />
                          {/* An outside collaborator has no directory record, so
                              their department and email are typed in — they are
                              the only way to reach the person later. */}
                          <input
                            type="text"
                            className="pf-input"
                            placeholder="Department"
                            value={row.department}
                            onChange={(event) => update(index, { department: event.target.value })}
                            disabled={disabled}
                            aria-label="External department"
                          />
                          <input
                            type="email"
                            className={`pf-input ${errors[`investigators[${index}].email`] ? 'is-invalid' : ''}`.trim()}
                            placeholder="Email"
                            value={row.email}
                            onChange={(event) => update(index, { email: event.target.value })}
                            disabled={disabled}
                            aria-label="External email"
                          />
                        </>
                      ) : (
                        <>
                          <SelectField
                            value={row.department}
                            onChange={(value) => update(index, { department: value })}
                            options={departmentOptions}
                            placeholder="Department"
                            disabled={disabled}
                            invalid={Boolean(errors[`investigators[${index}].department`])}
                            ariaLabel="Department"
                          />
                          {row.memberType === 'student' ? (
                            // The register number keys the student to their
                            // `author_students` record, which is what puts the
                            // project on the student's own dashboard.
                            <input
                              type="text"
                              className={`pf-input ${errors[`investigators[${index}].identity_code`] ? 'is-invalid' : ''}`.trim()}
                              placeholder="Register No."
                              value={row.identityCode}
                              onChange={(event) =>
                                update(index, { identityCode: event.target.value })
                              }
                              disabled={disabled}
                              aria-label="Register number"
                            />
                          ) : (
                            <input
                              type="text"
                              className="pf-input pf-input--readonly"
                              value={row.organization || HOST_ORGANIZATION_NAME}
                              readOnly
                              aria-label="Organization"
                              title={row.organization || HOST_ORGANIZATION_NAME}
                            />
                          )}
                        </>
                      )}

                      <RowActions
                        itemLabel="investigator"
                        onAdd={addRow}
                        showAdd={index === rows.length - 1}
                        addDisabled={rows.length >= MAX_INVESTIGATORS}
                        onRemove={() => removeRow(index)}
                        canRemove={rows.length > 1}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {droppable.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </SectionCard>
  );
};

export default InvestigatorsSection;
