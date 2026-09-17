import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { SelectField } from '../components/FormFields';
import RowActions from '../components/RowActions';
import SectionCard from '../components/SectionCard';
import {
  MAX_TRANSACTIONS_PER_ACCOUNT,
  MAX_TRANSACTION_ACCOUNTS,
  financialYearForDate,
  financialYearOptions,
} from '../constants';
import {
  formatAmount,
  headIdentity,
  parseHeadIdentity,
  runningBalances,
} from '../projectBudgetSummary';
import {
  createTransactionAccount,
  createTransactionRow,
  removeAt,
  replaceAt,
  sortTransactions,
} from '../projectFormState';
import { transactionHeadOptions, withSelectedOption } from '../selectOptions';

import type {
  AccountOption,
  BudgetHeadOption,
  ProjectFormState,
  TransactionAccount,
  TransactionRow,
} from '../types';

interface TransactionAccountsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  accounts: AccountOption[];
  budgetHeads: BudgetHeadOption[];
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * The fields a ledger row keeps in its expanded detail strip. The columns that
 * stay in the row itself are the ones a reader scans down — the year, the head
 * and the money — so the ones that describe a single entry drop out of the
 * table's width and into a second row beneath it.
 */
const DETAIL_ERROR_KEYS = ['transaction_date'];

/**
 * The Transaction tab: one block per bank account the project's money moves
 * through, each with its own ledger and its own running balance.
 *
 * Each row is two rows: the figures stay in the table, and the date,
 * particulars and reference number sit in a strip that expands under it. Nine
 * columns of inputs left every field too narrow to read at any window size.
 *
 * Balance is derived from the rows above it rather than typed, so it can never
 * contradict the credit and debit columns beside it.
 */
const TransactionAccountsSection: React.FC<TransactionAccountsSectionProps> = ({
  form,
  patch,
  accounts,
  budgetHeads,
  errors,
  disabled,
}) => {
  const blocks = form.transactionAccounts;

  // The one row the user is working on, by row key — the keys are stable across
  // the date re-sort, so a row stays open as it moves. One at a time: the strip
  // is as tall as the row above it, so several open at once push the figures a
  // reader is scanning down the table apart. Purely presentational, so it lives
  // here rather than in the form state that gets saved.
  //
  // `undefined` is the state before anyone has touched a toggle, which is not
  // the same as `null` — a row deliberately collapsed. It defers to the default
  // below rather than freezing a key at mount, because an edited project's rows
  // arrive after this mounts.
  const [expandedRow, setExpandedRow] = useState<string | null | undefined>(undefined);

  // Until a row is picked, the ledger's first row is the open one: a fresh
  // account's only entry still needs the date and particulars that live in the
  // strip, and leaving it shut hides them behind a control the user has to
  // find first.
  const openRow =
    expandedRow === undefined ? (blocks[0]?.transactions[0]?.key ?? null) : expandedRow;

  const toggleRow = (rowKey: string) => setExpandedRow(openRow === rowKey ? null : rowKey);

  const headOptions = useMemo(() => transactionHeadOptions(budgetHeads), [budgetHeads]);

  const yearOptions = useMemo(
    () => financialYearOptions().map((year) => ({ value: year, label: year })),
    [],
  );

  // An account already has a ledger on this project, so offering it again would
  // split one account's history into two running balances.
  const takenAccountIds = new Set(
    blocks.map((block) => block.accountOptionId).filter((id): id is number => id !== null),
  );

  const updateBlock = (index: number, changes: Partial<TransactionAccount>) =>
    patch({ transactionAccounts: replaceAt(blocks, index, changes) });

  // Touching a row is what says which entry is being worked on, so the row
  // being edited is the row whose details are showing — a new row opens on the
  // date and particulars it still needs, and an edit to any figure brings the
  // rest of that entry into view rather than leaving it a click away.
  const updateRow = (blockIndex: number, rowIndex: number, changes: Partial<TransactionRow>) => {
    setExpandedRow(blocks[blockIndex].transactions[rowIndex].key);
    updateBlock(blockIndex, {
      transactions: replaceAt(blocks[blockIndex].transactions, rowIndex, changes),
    });
  };

  const addRow = (blockIndex: number) => {
    const row = createTransactionRow();
    setExpandedRow(row.key);
    updateBlock(blockIndex, { transactions: [...blocks[blockIndex].transactions, row] });
  };

  return (
    <>
      {blocks.map((block, blockIndex) => {
        const balances = runningBalances(block.transactions);
        const accountError = errors[`transaction_accounts[${blockIndex}].account`];

        return (
          <SectionCard key={block.key} error={accountError}>
            <div className="pf-account">
              <span className="pf-account__label">Transaction Account</span>

              <SelectField
                className="pf-account__select"
                value={block.accountOptionId ? String(block.accountOptionId) : ''}
                onChange={(value) => {
                  const account = accounts.find((item) => String(item.id) === value);
                  updateBlock(blockIndex, {
                    accountOptionId: account?.id ?? null,
                    accountName: account?.name ?? '',
                  });
                }}
                options={withSelectedOption(
                  accounts
                    .filter(
                      (account) =>
                        account.id === block.accountOptionId || !takenAccountIds.has(account.id),
                    )
                    .map((account) => ({ value: String(account.id), label: account.name })),
                  block.accountOptionId ? String(block.accountOptionId) : '',
                  block.accountName,
                )}
                // A block whose account option was removed keeps only the name
                // snapshot, and there is no id left to select it by — so the
                // name shows here rather than leaving the ledger looking
                // unattributed. Picking a live account re-links the block.
                placeholder={block.accountName || 'Select'}
                disabled={disabled}
                invalid={Boolean(accountError)}
                ariaLabel="Transaction account"
              />

              <div className="pf-row-actions">
                {blockIndex === blocks.length - 1 && (
                  <button
                    type="button"
                    className="pf-icon-btn pf-icon-btn--add"
                    onClick={() =>
                      patch({ transactionAccounts: [...blocks, createTransactionAccount()] })
                    }
                    disabled={disabled || blocks.length >= MAX_TRANSACTION_ACCOUNTS}
                    aria-label="Add transaction account"
                    title={
                      blocks.length >= MAX_TRANSACTION_ACCOUNTS
                        ? 'Maximum number of transaction accounts reached'
                        : 'Add transaction account'
                    }
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  className="pf-icon-btn pf-icon-btn--remove"
                  onClick={() => patch({ transactionAccounts: removeAt(blocks, blockIndex) })}
                  disabled={disabled || blocks.length <= 1}
                  aria-label="Remove transaction account"
                  title={
                    blocks.length > 1
                      ? 'Remove this account and its transactions'
                      : 'At least one transaction account is required'
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="pf-table-wrap">
              <table className="pf-table pf-ledger">
                <thead>
                  <tr>
                    <th scope="col" className="pf-table__sno">
                      S.No.
                    </th>
                    <th scope="col" className="pf-ledger__year">
                      Financial Year
                    </th>
                    <th scope="col" className="pf-ledger__head">
                      Budget Head
                    </th>
                    <th scope="col" className="pf-table__amount">
                      Credit
                    </th>
                    <th scope="col" className="pf-table__amount">
                      Debit
                    </th>
                    <th scope="col" className="pf-table__amount">
                      Balance
                    </th>
                    <th scope="col" className="pf-table__actions">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {block.transactions.map((row, rowIndex) => {
                    const field = `transaction_accounts[${blockIndex}].transactions[${rowIndex}]`;
                    const selectedHead = row.headName
                      ? headIdentity(row.headKind, row.headName)
                      : '';
                    // A row whose hidden fields failed validation opens itself:
                    // an error the user cannot see is one they cannot fix.
                    const hasDetailError = DETAIL_ERROR_KEYS.some(
                      (key) => errors[`${field}.${key}`],
                    );
                    const isExpanded = openRow === row.key || hasDetailError;
                    const detailId = `${block.key}-${row.key}-detail`;

                    return (
                      <React.Fragment key={row.key}>
                        <tr>
                          <td className="pf-table__sno">{rowIndex + 1}</td>

                          <td className="pf-ledger__year">
                            <SelectField
                              value={row.financialYear}
                              onChange={(value) =>
                                updateRow(blockIndex, rowIndex, { financialYear: value })
                              }
                              options={yearOptions}
                              placeholder="Select"
                              disabled={disabled}
                              invalid={Boolean(errors[`${field}.financial_year`])}
                              ariaLabel="Financial year"
                            />
                          </td>

                          <td className="pf-ledger__head">
                            <SelectField
                              value={selectedHead}
                              onChange={(value) => {
                                const option = headOptions.find((item) => item.value === value);
                                if (!option) {
                                  updateRow(blockIndex, rowIndex, {
                                    headKind: 'expenditure',
                                    headName: '',
                                  });
                                  return;
                                }
                                updateRow(blockIndex, rowIndex, {
                                  ...parseHeadIdentity(value),
                                  headName: option.label,
                                });
                              }}
                              options={withSelectedOption(headOptions, selectedHead, row.headName)}
                              placeholder="Select"
                              disabled={disabled}
                              invalid={Boolean(errors[`${field}.head`])}
                              ariaLabel="Budget head"
                            />
                          </td>

                          <td className="pf-table__amount">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`pf-input pf-input--amount ${errors[`${field}.amount`] || errors[`${field}.credit`] ? 'is-invalid' : ''}`.trim()}
                              value={row.credit}
                              onChange={(event) =>
                                updateRow(blockIndex, rowIndex, { credit: event.target.value })
                              }
                              disabled={disabled}
                              aria-label="Credit"
                            />
                          </td>

                          <td className="pf-table__amount">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={`pf-input pf-input--amount ${errors[`${field}.amount`] || errors[`${field}.debit`] ? 'is-invalid' : ''}`.trim()}
                              value={row.debit}
                              onChange={(event) =>
                                updateRow(blockIndex, rowIndex, { debit: event.target.value })
                              }
                              disabled={disabled}
                              aria-label="Debit"
                            />
                          </td>

                          <td className="pf-table__amount">
                            <output className="pf-input pf-input--amount pf-input--readonly pf-ledger__balance">
                              {formatAmount(balances[rowIndex])}
                            </output>
                          </td>

                          <td className="pf-table__actions">
                            <RowActions
                              itemLabel="transaction"
                              leading={
                                <button
                                  type="button"
                                  className={`pf-icon-btn pf-icon-btn--ghost pf-ledger__toggle ${
                                    isExpanded ? 'is-open' : ''
                                  }`.trim()}
                                  onClick={() => toggleRow(row.key)}
                                  // A row held open by an error cannot be
                                  // collapsed, so the control says so rather
                                  // than offering to hide what it will not.
                                  disabled={hasDetailError}
                                  aria-expanded={isExpanded}
                                  aria-controls={detailId}
                                  aria-label={
                                    hasDetailError
                                      ? 'Fix the date to collapse this row'
                                      : isExpanded
                                        ? 'Hide date, particulars and reference number'
                                        : 'Show date, particulars and reference number'
                                  }
                                  title={
                                    hasDetailError
                                      ? 'Fix the date to collapse this row'
                                      : isExpanded
                                        ? 'Collapse'
                                        : 'Expand'
                                  }
                                >
                                  <ChevronDown size={16} aria-hidden="true" />
                                </button>
                              }
                              onAdd={() => addRow(blockIndex)}
                              showAdd={rowIndex === block.transactions.length - 1}
                              addDisabled={
                                block.transactions.length >= MAX_TRANSACTIONS_PER_ACCOUNT
                              }
                              onRemove={() =>
                                updateBlock(blockIndex, {
                                  transactions: removeAt(block.transactions, rowIndex),
                                })
                              }
                              canRemove={block.transactions.length > 1}
                              disabled={disabled}
                            />
                          </td>
                        </tr>

                        <tr id={detailId} className="pf-ledger__detail-row" hidden={!isExpanded}>
                          <td className="pf-ledger__detail-cell" colSpan={7}>
                            <div className="pf-ledger__detail">
                              <label className="pf-ledger__detail-field">
                                <span className="pf-ledger__detail-label">Date</span>
                                <input
                                  type="date"
                                  className={`pf-input ${errors[`${field}.transaction_date`] ? 'is-invalid' : ''}`.trim()}
                                  value={row.transactionDate}
                                  onChange={(event) => {
                                    const transactionDate = event.target.value;
                                    // Dating a row files it into the ledger,
                                    // which is kept oldest-first so the running
                                    // balance beside it means what it says. A
                                    // date input reports a value only once all
                                    // three parts are filled in, so this fires
                                    // when the date is complete rather than
                                    // shuffling rows as they are typed.
                                    // The year follows the date until someone
                                    // sets it themselves. A year that still
                                    // matches the year the old date implied was
                                    // filled in here, not chosen, so correcting
                                    // the date has to move it too — otherwise
                                    // the summary keeps grouping the row under
                                    // the year it was first dated in.
                                    const derivedBefore = financialYearForDate(row.transactionDate);
                                    const financialYear =
                                      !row.financialYear || row.financialYear === derivedBefore
                                        ? financialYearForDate(transactionDate) || ''
                                        : row.financialYear;

                                    updateBlock(blockIndex, {
                                      transactions: sortTransactions(
                                        replaceAt(block.transactions, rowIndex, {
                                          transactionDate,
                                          financialYear,
                                        }),
                                      ),
                                    });
                                  }}
                                  disabled={disabled}
                                />
                              </label>

                              <label className="pf-ledger__detail-field pf-ledger__detail-field--wide">
                                <span className="pf-ledger__detail-label">Particulars</span>
                                <input
                                  type="text"
                                  className="pf-input"
                                  value={row.particulars}
                                  onChange={(event) =>
                                    updateRow(blockIndex, rowIndex, {
                                      particulars: event.target.value,
                                    })
                                  }
                                  disabled={disabled}
                                />
                              </label>

                              <label className="pf-ledger__detail-field">
                                <span className="pf-ledger__detail-label">Ref. No.</span>
                                <input
                                  type="text"
                                  className="pf-input"
                                  value={row.referenceNo}
                                  onChange={(event) =>
                                    updateRow(blockIndex, rowIndex, {
                                      referenceNo: event.target.value,
                                    })
                                  }
                                  disabled={disabled}
                                />
                              </label>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })}
    </>
  );
};

export default TransactionAccountsSection;
