import React from 'react';

import { cn } from '../utils';
import './FormElements.css';

/**
 * Shared form primitives: Input, Select, RadioGroup, FileUpload, SectionCard,
 * NavButtons.
 *
 * Intentionally kept even though nothing imports it yet. The feature forms
 * (profile, registration, accommodation) each hand-roll their own inputs today,
 * and are due to be rewritten against the real API with server-side validation
 * and error states. These primitives are where that shared behaviour belongs, so
 * they should be adopted during that pass rather than rebuilt from scratch.
 *
 * Not imported means not bundled: Rollup excludes this module entirely, so it
 * costs users nothing while it waits.
 *
 * Do not duplicate these components inside a feature — extend them here.
 */

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className, id, ...props }: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;
  return (
    <div className="form-elements-1">
      {label && (
        <label htmlFor={inputId} className="form-elements-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn('input-field', error && 'border-red-400 focus:ring-red-400', className)}
        {...props}
      />
      {error && <p className="form-elements-3">{error}</p>}
    </div>
  );
}

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}
export function Select({ label, options, placeholder, className, id, ...props }: SelectProps) {
  const generatedId = React.useId();
  const selectId = id || generatedId;
  return (
    <div className="form-elements-4">
      {label && (
        <label htmlFor={selectId} className="form-elements-5">
          {label}
        </label>
      )}
      <select id={selectId} className={cn('input-field', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Radio Group
interface RadioGroupProps {
  label?: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}
export function RadioGroup({ label, name, options, value, onChange }: RadioGroupProps) {
  return (
    <fieldset className="form-elements-6 border-0 p-0 m-0">
      {label && <legend className="form-elements-7 float-left">{label}</legend>}
      <div className="form-elements-8">
        {options.map((opt) => (
          <label key={opt.value} className="form-elements-9">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="form-elements-10"
            />
            <span
              className={cn(
                'text-sm font-medium',
                value === opt.value ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// File Upload
interface FileUploadProps {
  label?: string;
  onChange: (file: File | null) => void;
  accept?: string;
  value?: File | null;
}
export function FileUpload({ label, onChange, accept, value }: FileUploadProps) {
  return (
    <div className="form-elements-11">
      {label && <span className="form-elements-12">{label}</span>}
      <div className="form-elements-13">
        <label className="form-elements-14">
          <svg className="form-elements-15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Choose File
          <input
            type="file"
            accept={accept}
            className="form-elements-16"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            aria-label={label || 'Choose file'}
          />
        </label>
        {value && <span className="form-elements-17">{value.name}</span>}
        {!value && <span className="form-elements-18">No file chosen</span>}
      </div>
    </div>
  );
}

// Section Card
export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="form-elements-19">
      <h3 className="form-elements-20">{title}</h3>
      <div className="form-elements-21">{children}</div>
    </section>
  );
}

// Navigation buttons
interface NavButtonsProps {
  onPrev?: () => void;
  onNext: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  loading?: boolean;
}
export function NavButtons({ onPrev, onNext, isFirst, isLast, loading }: NavButtonsProps) {
  return (
    <div className="form-elements-22">
      <button
        onClick={onPrev}
        disabled={isFirst}
        className={cn('btn-secondary', isFirst && 'invisible')}
      >
        ← Previous
      </button>
      <button onClick={onNext} disabled={loading} className="form-elements-23">
        {loading ? 'Saving...' : isLast ? '✓ Submit Registration' : 'Save & Continue →'}
      </button>
    </div>
  );
}
