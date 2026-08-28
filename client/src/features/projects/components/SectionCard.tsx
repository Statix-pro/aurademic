import React from 'react';

interface SectionCardProps {
  title?: string;
  /** Rendered on the title row, right-aligned (radios, buttons, totals). */
  headerRight?: React.ReactNode;
  /** When provided, the card shows a switch and can be turned off entirely. */
  toggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
  };
  /** Inline sections keep the title on the same row as the fields. */
  inline?: boolean;
  className?: string;
  error?: string;
  children: React.ReactNode;
}

/**
 * The card every section of the project form sits in: a blue heading, an
 * optional right-hand slot, and an optional enable switch. Sections that are
 * switched off collapse to just the heading, as in the design.
 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  headerRight,
  toggle,
  inline = false,
  className = '',
  error,
  children,
}) => {
  const switchId = title ? `pf-toggle-${title.replace(/\W+/g, '-').toLowerCase()}` : undefined;

  return (
    <section className={`pf-card ${inline ? 'pf-card--inline' : ''} ${className}`.trim()}>
      {(title || headerRight || toggle) && (
        <header className={`pf-card__header ${inline ? 'pf-card__header--inline' : ''}`.trim()}>
          {title && <h2 className="pf-card__title">{title}</h2>}

          <div className="pf-card__header-right">
            {headerRight}
            {toggle && (
              <div className="form-check form-switch pf-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={switchId}
                  checked={toggle.checked}
                  onChange={(event) => toggle.onChange(event.target.checked)}
                  disabled={toggle.disabled}
                  aria-label={toggle.label ?? `Enable ${title ?? 'section'}`}
                />
              </div>
            )}
          </div>
        </header>
      )}

      {error && <p className="pf-card__error">{error}</p>}

      {(!toggle || toggle.checked) && <div className="pf-card__body">{children}</div>}
    </section>
  );
};

export default SectionCard;
