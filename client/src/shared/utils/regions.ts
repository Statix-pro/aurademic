/**
 * Country and State choices for the directory address fields. Records store plain text, so
 * a country other than India, or a state not listed here, is typed in and kept as typed.
 */
export const DEFAULT_COUNTRY = 'India';

/** India's 28 states and 8 union territories, alphabetical. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

/** The listed spelling of a state, matched case-insensitively; undefined when not listed. */
export const toListedState = (value: string) =>
  INDIAN_STATES.find((state) => state.toLowerCase() === value.trim().toLowerCase());

export const isIndia = (country: string) =>
  !country.trim() || country.trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();
