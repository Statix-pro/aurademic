import React from 'react';

import './adminScreen.css';

/**
 * The shell the admin master-data screens share — Project Options, Master Data
 * and the Budget Catalog. Each used to bring its own header and its own tab
 * strip, so three screens doing the same job looked like three products.
 *
 * Markup only: everything visual lives in `adminScreen.css`, and a screen keeps
 * its own table and dialogs.
 */

interface AdminScreenHeaderProps {
  title: string;
  /** One sentence on what the screen is for. */
  description?: React.ReactNode;
  /** The screen's primary action, and anything sitting beside it. */
  actions?: React.ReactNode;
}

export const AdminScreenHeader: React.FC<AdminScreenHeaderProps> = ({
  title,
  description,
  actions,
}) => (
  <div className="admin-screen__header">
    <div className="admin-screen__heading">
      <h1 className="admin-screen__title">{title}</h1>
      {description && <p className="admin-screen__subtitle">{description}</p>}
    </div>

    {actions && <div className="admin-screen__header-actions">{actions}</div>}
  </div>
);

export interface AdminTabItem<Key extends string = string> {
  key: Key;
  label: string;
  /** Rows behind the tab, shown as a pill so the size is legible unopened. */
  count?: number;
}

interface AdminTabsProps<Key extends string> {
  tabs: AdminTabItem<Key>[];
  active: Key;
  onChange: (key: Key) => void;
}

export function AdminTabs<Key extends string>({ tabs, active, onChange }: AdminTabsProps<Key>) {
  return (
    <div className="admin-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={`admin-tab ${active === tab.key ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="admin-tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

interface AdminIconButtonProps {
  icon: React.ReactNode;
  /** Used as both the tooltip and the accessible name. */
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export const AdminIconButton: React.FC<AdminIconButtonProps> = ({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}) => (
  <button
    type="button"
    className={`admin-icon-btn ${variant === 'danger' ? 'admin-icon-btn--danger' : ''}`.trim()}
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
  >
    {icon}
  </button>
);
