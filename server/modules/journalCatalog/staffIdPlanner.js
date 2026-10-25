/**
 * Plans a staff Scopus Author ID sheet: one outcome per row, against the staff list, the IDs
 * already on file and the imported papers each ID would credit. Pure, so its rules are pinned
 * by unit tests.
 *
 * An ID already on file for a different staff member is never moved: two people cannot be the
 * author behind one Scopus profile, so which of them it is goes to a person.
 */

const normalizeErp = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const planStaffRow = (record, context, seen) => {
  const issues = [];
  for (const raw of record.invalidIds) issues.push(`"${raw}" is not a Scopus Author ID`);

  const employee = context.byErp.get(normalizeErp(record.erpId)) ?? null;
  if (!record.erpId) issues.push('No ERP ID given');
  else if (!employee) issues.push(`No staff member has ERP ID "${record.erpId}"`);

  for (const id of record.scopusIds) {
    const holder = context.held.get(id);
    if (holder && holder.id !== employee?.id) {
      issues.push(`Scopus ID ${id} is already on file for ${holder.name} (ERP ${holder.erp_id})`);
    }
    if (context.conflicts.has(id)) {
      issues.push(`Scopus ID ${id} is on file for two staff members`);
    }
    const firstLine = seen.get(id);
    if (firstLine && firstLine.erp !== normalizeErp(record.erpId)) {
      issues.push(`Scopus ID ${id} is also given on line ${firstLine.line}`);
    } else if (!firstLine) {
      seen.set(id, { line: record.line, erp: normalizeErp(record.erpId) });
    }
  }

  const theirs = new Set(
    employee
      ? [...context.held].filter(([, holder]) => holder.id === employee.id).map(([id]) => id)
      : [],
  );
  const newIds = record.scopusIds.filter((id) => !theirs.has(id));
  const papers = newIds.reduce((sum, id) => sum + (context.unassigned.get(id) ?? 0), 0);
  const label = employee
    ? `${employee.name} (ERP ${employee.erp_id})`
    : `ERP ID ${record.erpId || '—'}`;

  return {
    outcome: issues.length > 0 ? 'exception' : newIds.length > 0 ? 'add' : 'unchanged',
    journal_option_id: null,
    publication_id: null,
    journal_name: label,
    reason: issues.join('; ') || null,
    payload: { action: 'add', erpId: record.erpId, scopusIds: newIds },
    changes:
      newIds.length > 0
        ? [
            {
              field: 'Scopus Author ID',
              from: theirs.size > 0 ? [...theirs].join(', ') : null,
              to: newIds.join(', '),
            },
            { field: 'Papers credited', from: null, to: papers },
          ]
        : [],
    papers,
  };
};

/**
 * `employees` is every staff member (id, erp_id, name); `held` maps each Scopus ID on file to its
 * staff member, `conflicts` the IDs on file for two; `unassigned` maps an ID to the imported
 * papers it is an uncredited KSRCT author on.
 */
export const planStaffIds = ({
  records,
  employees,
  held,
  conflicts,
  unassigned,
  excluded = {},
}) => {
  const context = {
    byErp: new Map(employees.map((employee) => [normalizeErp(employee.erp_id), employee])),
    held,
    conflicts,
    unassigned,
  };
  const seen = new Map();
  const rows = records.map((record) => ({
    source_row: record.line,
    ...planStaffRow(record, context, seen),
  }));

  const outcomes = { add: 0, update: 0, unchanged: 0, exception: 0 };
  let papersToCredit = 0;
  for (const row of rows) {
    outcomes[row.outcome] += 1;
    if (row.outcome === 'add') papersToCredit += row.papers;
  }
  return {
    rows: rows.map(({ papers: _papers, ...row }) => row),
    summary: { outcomes, excluded, staff: { papersToCredit } },
  };
};
