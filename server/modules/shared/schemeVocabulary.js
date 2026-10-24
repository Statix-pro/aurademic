/**
 * Checks for a funding scheme's domain and category, and the project types a
 * scheme can fund.
 *
 * A scheme reaches `project_schemes` two ways — an administrator adds it on
 * Form Management, or a researcher requests it from the project form's Add
 * Scheme and an administrator approves the request — so the checks live here
 * rather than in either module. Values are stored as the label itself: the
 * columns are display text that the project form and the admin dashboard show
 * as-is.
 *
 * The lists themselves are curated in `project_vocabulary_options` (see
 * `projectVocabularyStore.js`); callers load them and pass them in, which
 * keeps this module free of database access.
 *
 * A scheme funds one kind of grant, and its category comes from that kind's
 * own list. A travel grant scheme has no domain.
 */

/** Matches `project_schemes.project_type` and `research_projects.project_type`. */
export const SCHEME_PROJECT_TYPES = ['research_project', 'event', 'travel_grant', 'fellowship'];

const DEFAULT_PROJECT_TYPE = 'research_project';

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
export const toSchemeDomain = (value, projectType = DEFAULT_PROJECT_TYPE, domains = []) =>
  schemeHasDomain(projectType) ? toListed(value, domains, 'domain') : null;

/** `categoriesByType` maps a project type to its category names. */
export const toSchemeCategory = (
  value,
  projectType = DEFAULT_PROJECT_TYPE,
  categoriesByType = {},
) => toListed(value, categoriesByType[projectType] ?? [], 'category');
