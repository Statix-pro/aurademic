/**
 * The closed lists a funding scheme's domain and category are picked from, and
 * the project types a scheme can fund.
 *
 * A scheme reaches `project_schemes` two ways — an administrator adds it on
 * Form Management, or a researcher requests it from the project form's Add
 * Scheme and an administrator approves the request — so the lists live here
 * rather than in either module. They are stored as the label itself: the
 * columns are display text that the project form and the admin dashboard
 * show as-is.
 *
 * A scheme funds one kind of grant, and its category comes from that kind's
 * own list. A travel grant scheme has no domain.
 */

/** Matches `project_schemes.project_type` and `research_projects.project_type`. */
export const SCHEME_PROJECT_TYPES = ['research_project', 'event', 'travel_grant', 'fellowship'];

const DEFAULT_PROJECT_TYPE = 'research_project';

export const SCHEME_DOMAINS = [
  'Innovation',
  'Start-up & Entrepreneurship',
  'Societal Development',
  'Engineering and Technology',
  'Science and Technology',
  'Agriculture and Biotechnology',
  'Health, Food and Nutrition',
  'Medicine',
  'Life Sciences',
  'Nano Science',
  'Materials',
  'Manufacturing',
  'Electronics',
  'Textile',
  'Civil & Infrastructure',
  'Energy',
  'Futuristic Technology',
  'Science, Technology, Engineering and Mathematics (STEM)',
  'Artificial Intelligence',
  'Computing Science',
  'Multidisciplinary',
  'Environment and Climate',
  'Social Science',
  'Traditional Knowledge',
  'Mathematics',
];

export const SCHEME_CATEGORIES_BY_TYPE = {
  research_project: [
    'Research Project',
    'Product Development',
    'Community Outreach',
    'Survey',
    'Infrastructure',
    'Incubation/Start-up',
    'Collaborative Research',
    'Industrial R&D',
    'Facilities Access',
    'Centre of Excellence',
  ],
  event: [
    'Seminar',
    'Workshop',
    'Conference',
    'Faculty Development Programme',
    'Entrepreneurship Development Programme',
    'Campaign',
    'Science Day',
    'Earth Day',
    'Competition',
    'Dissemination of Innovative Technology',
    'Bilateral Workshop',
    'Bilateral Conference',
  ],
  travel_grant: ['Conference Travel Grant', 'Research Travel Grant'],
  fellowship: [
    'Post Doctoral Fellowship',
    'Doctoral Fellowship',
    'Summer Research Fellowship',
    'Women Scientist',
    'Research Scholar Fellowship',
  ],
};

/** Whether a scheme of this type carries a domain at all. */
export const schemeHasDomain = (projectType) => projectType !== 'travel_grant';

/**
 * The listed label a value names, matched without regard to case, or null for
 * an empty value. Throws a 400 for anything else, the way `toStoredWebsite`
 * does, so a caller answers the request instead of storing a value the
 * dropdowns cannot show.
 */
function toListed(value, allowed, label) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const match = allowed.find((entry) => entry.toLowerCase() === text.toLowerCase());
  if (!match) {
    throw badRequest(`Choose the scheme's ${label} from the list.`);
  }
  return match;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/** A scheme's project type; an unstated one is a research project, as before. */
export function toSchemeProjectType(value) {
  const text = String(value ?? '').trim();
  if (!text) return DEFAULT_PROJECT_TYPE;
  if (!SCHEME_PROJECT_TYPES.includes(text)) {
    throw badRequest('Choose what kind of grant the scheme funds.');
  }
  return text;
}

/**
 * A travel grant scheme has no domain, so whatever arrives for one is not
 * kept — the form hides the field, and a value left over from the type the
 * scheme was before is not a domain the scheme has.
 */
export const toSchemeDomain = (value, projectType = DEFAULT_PROJECT_TYPE) =>
  schemeHasDomain(projectType) ? toListed(value, SCHEME_DOMAINS, 'domain') : null;

export const toSchemeCategory = (value, projectType = DEFAULT_PROJECT_TYPE) =>
  toListed(value, SCHEME_CATEGORIES_BY_TYPE[projectType] ?? [], 'category');
