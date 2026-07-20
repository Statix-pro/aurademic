import React from 'react'
import { cn } from '../../lib/utils'

// Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}
export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="label">{label}</label>}
      <input className={cn('input-field', error && 'border-red-400 focus:ring-red-400', className)} {...props} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
  placeholder?: string
}
export function Select({ label, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="label">{label}</label>}
      <select className={cn('input-field', className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// Radio Group
interface RadioGroupProps {
  label?: string
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}
export function RadioGroup({ label, name, options, value, onChange }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="label">{label}</label>}
      <div className="flex gap-4 flex-wrap">
        {options.map(opt => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-blue-700"
            />
            <span className={cn(
              'text-sm font-medium',
              value === opt.value ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'
            )}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// File Upload
interface FileUploadProps {
  label?: string
  onChange: (file: File | null) => void
  accept?: string
  value?: File | null
}
export function FileUpload({ label, onChange, accept, value }: FileUploadProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-3">
        <label className="btn-primary flex items-center gap-2 cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Choose File
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={e => onChange(e.target.files?.[0] || null)}
          />
        </label>
        {value && (
          <span className="text-xs text-slate-500 truncate max-w-[200px]">{value.name}</span>
        )}
        {!value && <span className="text-xs text-slate-400">No file chosen</span>}
      </div>
    </div>
  )
}

// Section Card
export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <h3 className="section-title">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

// Navigation buttons
interface NavButtonsProps {
  onPrev?: () => void
  onNext: () => void
  isFirst?: boolean
  isLast?: boolean
  loading?: boolean
}
export function NavButtons({ onPrev, onNext, isFirst, isLast, loading }: NavButtonsProps) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700 mt-6">
      <button
        onClick={onPrev}
        disabled={isFirst}
        className={cn('btn-secondary', isFirst && 'invisible')}
      >
        ← Previous
      </button>
      <button
        onClick={onNext}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Saving...' : isLast ? '✓ Submit Registration' : 'Save & Continue →'}
      </button>
    </div>
  )
}
