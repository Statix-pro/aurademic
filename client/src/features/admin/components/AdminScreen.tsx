import React, { useRef } from 'react';

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
  const stripRef = useRef<HTMLDivElement>(null);

  /**
   * What `role="tab"` promises a keyboard user: the arrows walk the strip and
   * switch as they go, Home and End jump to either end, and only the selected
   * tab is in the page's tab order, so Tab steps over the strip in one press
   * rather than once per tab.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.key === active);
    if (index < 0) return;

    let next = index;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(tabs[next].key);
    // Focus follows selection; the button is already on screen, so it only has
    // to be found again after the key moved which one is selected.
    stripRef.current?.querySelectorAll<HTMLButtonElement>('.admin-tab')[next]?.focus();
  };

  return (
    <div
      className="admin-tabs"
      role="tablist"
      aria-orientation="horizontal"
      ref={stripRef}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          tabIndex={active === tab.key ? 0 : -1}
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
