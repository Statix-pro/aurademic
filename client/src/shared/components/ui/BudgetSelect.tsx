import Select, { type SingleValue } from 'react-select';

export interface BudgetSelectOption {
  value: string;
  label: string;
}

interface BudgetSelectProps {
  value: BudgetSelectOption | null;
  onChange: (option: SingleValue<BudgetSelectOption>) => void;
  options: BudgetSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

/** The select used by the Budget beneficiary fields. Reuse it where an identical UI is required. */
const BudgetSelect = ({ value, onChange, options, placeholder = '', disabled = false }: BudgetSelectProps) => (
  <Select<BudgetSelectOption, false>
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder}
    isSearchable
    isClearable={false}
    isDisabled={disabled}
    menuPosition="fixed"
    menuPlacement="auto"
    styles={{
      control: (base, state) => ({
        ...base,
        minHeight: '45px',
        height: 45,
        borderRadius: 12,
        border: state.isFocused ? '1px solid #0069ab' : '1px solid #e0e0e0',
        backgroundColor: '#fcfdff',
        boxShadow: state.isFocused ? '0 0 0 3px rgba(0, 105, 171, 0.15)' : 'none',
      }),
      dropdownIndicator: (base, state) => ({
        ...base,
        padding: '0 15px',
        color: '#666',
        transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      }),
      indicatorSeparator: () => ({ display: 'none' }),
      valueContainer: (base) => ({ ...base, padding: '2px 15px', color: '#333' }),
      singleValue: (base) => ({ ...base, color: '#333', fontSize: '0.95rem' }),
      input: (base) => ({ ...base, color: '#333', padding: '0 15px' }),
      menu: (base) => ({
        ...base,
        zIndex: 900,
        backgroundColor: 'white',
        borderRadius: 12,
        boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
      }),
      option: (base, state) => ({
        ...base,
        padding: '10px 15px',
        backgroundColor: state.isSelected
          ? '#0069ab'
          : state.isFocused
            ? 'rgba(0,105,171,0.1)'
            : 'white',
        color: state.isSelected ? 'white' : '#333',
      }),
    }}
  />
);

export default BudgetSelect;
