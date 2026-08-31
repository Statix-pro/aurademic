import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo } from 'react';

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

import type { BudgetHead } from '../../../shared/hooks/useBudgetCatalog';
import type { AccountOption, ProjectFormState, TransactionAccount, TransactionRow } from '../types';

interface TransactionAccountsSectionProps {
  form: ProjectFormState;
  patch: (changes: Partial<ProjectFormState>) => void;
  accounts: AccountOption[];
  budgetHeads: BudgetHead[];
  errors: Record<string, string>;
  disabled: boolean;
}

/**
 * The Transaction tab: one block per bank account the project's money moves
 * through, each with its own ledger and its own running balance.
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

  const updateRow = (blockIndex: number, rowIndex: number, changes: Partial<TransactionRow>) =>
    updateBlock(blockIndex, {
      transactions: replaceAt(blocks[blockIndex].transactions, rowIndex, changes),
    });

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
                    <th scope="col">Financial Year</th>
                    <th scope="col">Date</th>
                    <th scope="col">Budget Head</th>
                    <th scope="col" className="pf-ledger__particulars">
                      Particulars
                    </th>
                    <th scope="col">Ref. No.</th>
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
                    const selectedHead =
                      row.budgetHeadId || row.headName
                        ? headIdentity(row.headKind, row.budgetHeadId, row.headName)
                        : '';

                    return (
                      <tr key={row.key}>
                        <td className="pf-table__sno">{rowIndex + 1}</td>

                        <td>
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

                        <td>
                          <input
                            type="date"
                            className={`pf-input ${errors[`${field}.transaction_date`] ? 'is-invalid' : ''}`.trim()}
                            value={row.transactionDate}
                            onChange={(event) => {
                              const transactionDate = event.target.value;
                              // Dating a row files it into the ledger, which is
                              // kept oldest-first so the running balance beside
                              // it means what it says. A date input reports a
                              // value only once all three parts are filled in,
                              // so this fires when the date is complete rather
                              // than shuffling rows as they are typed.
                              // The year follows the date until someone sets it
                              // themselves. A year that still matches the year
                              // the old date implied was filled in here, not
                              // chosen, so correcting the date has to move it
                              // too — otherwise the summary keeps grouping the
                              // row under the year it was first dated in.
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
                            aria-label="Transaction date"
                          />
                        </td>

                        <td>
                          <SelectField
                            value={selectedHead}
                            onChange={(value) => {
                              const option = headOptions.find((item) => item.value === value);
                              if (!option) {
                                updateRow(blockIndex, rowIndex, {
                                  headKind: 'expenditure',
                                  budgetHeadId: null,
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

                        <td className="pf-ledger__particulars">
                          <input
                            type="text"
                            className="pf-input"
                            value={row.particulars}
                            onChange={(event) =>
                              updateRow(blockIndex, rowIndex, { particulars: event.target.value })
                            }
                            disabled={disabled}
                            aria-label="Particulars"
                          />
                        </td>

                        <td>
                          <input
                            type="text"
                            className="pf-input"
                            value={row.referenceNo}
                            onChange={(event) =>
                              updateRow(blockIndex, rowIndex, { referenceNo: event.target.value })
                            }
                            disabled={disabled}
                            aria-label="Reference number"
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
                            onAdd={() =>
                              updateBlock(blockIndex, {
                                transactions: [...block.transactions, createTransactionRow()],
                              })
                            }
                            showAdd={rowIndex === block.transactions.length - 1}
                            addDisabled={block.transactions.length >= MAX_TRANSACTIONS_PER_ACCOUNT}
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
