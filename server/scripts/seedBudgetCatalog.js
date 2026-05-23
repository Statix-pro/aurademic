/* eslint-disable no-console */
/**
 * Seeds the `budget_heads` and `budget_sub_heads` tables from the union of
 * the previously-hardcoded constants in:
 *   - client/src/features/budget/budget.tsx
 *   - client/src/features/expenditure/expenditureapproval.tsx
 *   - client/src/features/finance/financeapproval.tsx
 *
 * Run once after applying migration 20260520_create_budget_catalog.sql.
 *   node server/scripts/seedBudgetCatalog.js
 *
 * Safe to re-run: uses INSERT IGNORE-style logic (skips existing rows by name+scope).
 */

import '../config/env.js';
import db from '../config/connection.js';

// ============================================
// HEADS (group → ordered head names)
// Source of truth: union of all three files; budget.tsx ordering preferred.
// ============================================
const BUDGET_HEAD_GROUPS = [
    {
        label: 'Non-Recurring',
        heads: [
            'Civil Infrastructure',
            'Electrical Infrastructure',
            'IT Infrastructure',
            'Furniture & Fixtures',
            'Vehicles',
            'Equipment',
            'Accessories & Kits',
            'Library',
        ],
    },
    {
        label: 'Maintenance & Spares',
        heads: ['Maintenance Charges', 'Spares', 'Annual Maintenance Charges'],
    },
    {
        label: 'Operational',
        heads: [
            'Consumables',
            'Software',
            'Membership & Subscriptions',
            'College Essentials',
            'Student Essentials',
            'Printing',
            'Stationery',
            'Printing & Stationery',
            'Postal Expenses',
            'Local Conveyance',
            'Operational Expenses',
            'Official Visits',
        ],
    },
    {
        label: 'Events & Engagement',
        heads: ['Events & Competitions', 'Meetings & Audits'],
    },
    {
        label: 'Events & Competitions',
        heads: [
            'Academic Events',
            'Club Activities',
            'College Events',
            'Conferences & Conclaves',
            'Association Activities',
            'Outreach Events',
            'Cultural & Celebrations',
            'Sports',
            'Competitions',
        ],
    },
    {
        label: 'Meetings & Audits',
        heads: [
            'Institutional Governance Meetings',
            'Academic Governance Meetings',
            'Institutional Audits',
            'Government Meetings',
        ],
    },
    {
        label: 'Academics',
        heads: [
            'Faculty Empowerment',
            'Staff Empowerment',
            'Student Empowerment',
            'Student Capacity Building',
            'Ranking & Accreditation',
            'Examination Expenses',
            'Learning Resources',
            'Accreditation Expenses',
            'Professional Body Expenses',
            'Awards & Recognition',
        ],
    },
    {
        label: 'Branding & Outreach',
        heads: ['Advertisement & Branding', 'Public Relations', 'Admissions'],
    },
    {
        label: 'General',
        heads: [
            'Research & Development',
            'Government Funded Projects',
            'Government Funded Events',
            'Administrative Expenses',
            'Licenses & Taxes',
            'Salary',
            'Bills & Payments',
            'Miscellaneous Expenses',
        ],
    },
];

// ============================================
// HEAD-SPECIFIC SUB-HEADS (union from budget.tsx + expenditureapproval.tsx + financeapproval.tsx)
// ============================================
const SUB_HEAD_BY_HEAD = {
    'Civil Infrastructure': [
        'Canopy', 'Construction Works', 'False Ceiling Works', 'Partition Works',
        'Plumbing Works', 'Water Cooler',
    ],
    'Electrical Infrastructure': [
        'Air Conditioner', 'Battery', 'Electrical Wiring', 'Generator',
        'Lights & Fans', 'Lift Installation', 'UPS & Inverter', 'UPS Inverter',
    ],
    'IT Infrastructure': [
        'A/V Equipment', 'Amplifiers', 'CCTV Materials', 'CMOS Battery',
        'Desktops', 'Desktops Computers', 'Hard Disks', 'Hardwares',
        'Interactive Displays', 'Intercom', 'Keyboard', 'Laptops',
        'Mic & Speakers', 'Mobiles & Tablet', 'Monitors', 'Mouse',
        'Network Materials', 'Printers', 'Projectors', 'Softwares',
        'Television', 'Wi-fi Router', 'Xerox Machine',
    ],
    'Furniture & Fixtures': [
        'Chair', 'Computer Table', 'Discussion Table', 'Faculty Table',
        'Wooden Cup Boards', 'Work Table',
    ],
    Vehicles: ['Heavy Motor Vehicle', 'Light Motor Vehicle', 'Two Wheeler'],
    Equipment: [
        'Consultancy Equipment', 'Equipment Upgrade', 'Lab Equipment',
        'Minor Equipment', 'Office Equipment', 'Research Equipment',
        'Sports Equipment',
    ],
    'Accessories & Kits': [
        'Drilling Machine', 'Drone Kit', 'Lab Accessories', 'Power Tools',
        'Weighing Machine', 'Others',
    ],
    Library: [
        'Books', 'Databases', 'E-Books', 'E-Journals', 'Journals', 'Magazines',
        'Membership', 'Newspapers', 'Non Books (CD etc.)',
        'Plagiarism Detection Tool', 'Remote Access Tool',
    ],
    'Maintenance Charges': [
        'AC Maintenance', 'Annual Maintenance Charges', 'Building Maintenance',
        'Computer Maintenance', 'Electrical Maintenance', 'Equipment Maintenance',
        'Farm Maintenance', 'Furniture Maintenance', 'Garden Maintenance',
        'General Repairs', 'Housekeeping Expenses', 'Infrastructure Maintenance',
        'Lift Maintenance', 'Office Maintenance', 'Painting',
        'Playground Maintenance', 'Plumbing Maintenance', 'Printer Maintenance',
        'Software Maintenance', 'UPS Maintenance', 'Vehicle Maintenance',
        'Toner Refill',
    ],
    Spares: ['Chargers', 'Printer Donors', 'Printer Toner', 'SMPS'],
    'Annual Maintenance Charges': ['Equipment Maintenance', 'Software Maintenance'],
    Consumables: [
        'Carpentary Items', 'Chemicals', 'Construction Materials', 'Cutting Tools',
        'Electrical Components', 'Electronic Components', 'Glasswares',
        'Mechanical Components', 'Metals & Alloys', 'Oils & Lubricants',
        'Plasticwares', 'Others',
    ],
    Software: [
        'AI Tools', 'Analysis', 'Antivirus', 'Firewall', 'Graphical Design',
        'Grammer Check', 'Grievance', 'Modelling', 'Plagiarism', 'Programming',
        'Others',
    ],
    'Membership & Subscriptions': [
        'Annual Membership fee', 'Annual Subscription Charges',
        'Data Subscription Charges', 'DELNET', 'E-Resources', 'Journals',
        'Magazines', 'Membership fees', 'Newspaper', 'Professional Body fees',
    ],
    'College Essentials': [
        'Books', 'Note Books', 'Log Books', 'ID Card', 'Student Uniform', 'Others',
    ],
    'Student Essentials': ['Note Books', 'Log Books', 'ID Card', 'Others'],
    Printing: [
        'Badge', 'Banner', 'Beach Flag', 'Binding', 'Brochure', 'Calendar',
        'Certificates', 'Combined Items', 'Diary', 'ID Card', 'Letter Pad',
        'Magazines', 'News Letters', 'Note Pad', 'Official Documents', 'Pamphlet',
        'Registers', 'Reports', 'Sign Board', 'Vinyl Board', 'Visiting Card',
        'Wiro Pad', 'Others',
    ],
    Stationery: [
        'Adhesive Gum', 'Adhesive Tape', 'Answer Booklet', 'Chalk Box',
        'Clips/ Pins', 'Cloth Covers', 'Combined Items', 'Duster',
        'Files/ Folders', 'Grade Sheet', 'Highlighter', 'Marker Pen',
        'Office Covers', 'Pen/ Pencil/ Eraser', 'Plastic Tray', 'Print Sheets',
        'Rubber Band', 'Rubber Stamp', 'Scissor/ Knife', 'Stamp Pad/ Ink',
        'Stapler/ Punching Machine', 'Sticky Notes', 'Others',
    ],
    'Printing & Stationery': [
        'Banner', 'Pamphlet', 'Brochure', 'Vinyl Boards', 'Certificates',
        'Diary', 'Calendar', 'Visitng Card', 'Seal/ Stamp Pad',
        'Pen/ Pencil/ Eraser', 'Stapler/ Punching Machine', 'Files/ Folders',
        'Entry Registers', 'Print Sheets', 'Others',
    ],
    'Postal Expenses': [
        'Courier Charges', 'Frieght Charges', 'Postal Charges', 'Others',
    ],
    'Local Conveyance': [
        'Beta', 'Food & Refreshment', 'Travel Expense', 'Others',
    ],
    'Operational Expenses': [
        'Water Bottle', 'Food & Refreshment', 'Pooja Expenses', 'Accessories',
        'Legal stamp paper', 'Miscellaneous',
    ],
    'Official Visits': [
        'Registration fees', 'Travel', 'Accommodation', 'Food & Refreshment',
        'Local Conveyance', 'Printing & Stationery', 'Miscellaneous',
    ],
    'Events & Competitions': [
        'A/V Arrangements', 'Accessories', 'Accommodation', 'Auditing Charge',
        'Bag', 'Consumables', 'Decorations', 'Driver Bata', 'Event Logistics',
        'Food & Refreshment', 'Give away', 'Honorarium', 'Memento & Gifts',
        'Miscellaneous', 'Printing', 'Prizes', 'Promotions', 'Publication Charges',
        'Refund', 'Registration fee', 'Registration Kit', 'Remuneration',
        'Sitting Fees', 'Stationary', 'Stationery', 'T-Shirt', 'T-shirt',
        'Travel', 'Others',
    ],
    'Meetings & Audits': [
        'Accessories', 'Accommodation', 'Auditing Charge', 'Driver Bata',
        'Food & Refreshment', 'Honorarium', 'Memento & Gifts', 'Miscellaneous',
        'Printing', 'Registration fee', 'Remuneration', 'Sitting Fees',
        'Stationary', 'Stationery', 'Travel', 'Others',
    ],
    'Academic Events': [
        'Expert Visit', 'FDP (Faculty Development Programme)', 'Guest Lecture',
        'Hands-on Training', 'Industry Visit', 'MoU Inking', 'Seminar',
        'STTP (Short-Term Training Programme)', 'Webinar', 'Workshop',
    ],
    'Club Activities': ['Flash Mob', 'Fun Events', 'Road show', 'Wall Painting'],
    'College Events': [
        'Annual Day', 'Dakshaa', 'Founder Day', 'Graduation Day',
        'Orientation Session', 'Science Day', 'Student Induction Programme',
        'Womens Day',
    ],
    'Conferences & Conclaves': [
        'Conclave', 'Consumables', 'Convention', 'Industry Interaction',
        'International Conference', 'National Conference', 'Networking Event',
    ],
    'Association Activities': [
        'Alumni Interaction', 'Alumni Meeting', 'Association Function',
        'Parents Meeting',
    ],
    'Outreach Events': [
        'Awareness Program', 'Campaigns', 'Crash Course', 'Education Fair',
        'Grama Saba Meet', 'Mini Marathon', 'Orientation Session', 'Rally',
        'School Visit', 'Summer Internship',
    ],
    'Cultural & Celebrations': [
        'Celebration Day', 'Festival Celebrations', 'Harmonicks', 'Hostel Day',
    ],
    Sports: ['Sports Day', 'Sports Meet'],
    Competitions: [
        'Academic Competitions', 'Creative Competitions', 'Cultural Competitions',
        'General Competitions', 'Innovation & Startup Competitions',
        'Literary Competitions', 'Management Competitions', 'Online Competitions',
        'Project Exhibition', 'Science Exhibition', 'Sports Competitions',
        'Technical Competitions',
    ],
    'Institutional Governance Meetings': [
        'Examination Committee Meeting', 'Finance Committee Meeting',
        'Governing Body Meeting', 'IQAC Meeting', 'Placement Meeting',
        'Research Advisory Board Meeting', 'Result Passing Board (RPB) Meeting',
    ],
    'Academic Governance Meetings': [
        'Academic Council Meeting', 'Board of Studies (Bos) Meeting',
        'DAB Meeting', 'Standing Committee Meeting',
    ],
    'Institutional Audits': [
        'Academic Audit', 'Administrative Audit', 'Energy & Green Audit',
    ],
    'Government Meetings': ['Government Meetings'],
    'Faculty Empowerment': [
        'Accommodation', 'Daily Allowance', 'Faculty Welfare', 'Food & Refreshment',
        'Incentives', 'Leadership Meet', 'Medical Expenses', 'Membership Fees',
        'Registration fee', 'Travel Allowance',
    ],
    'Staff Empowerment': [
        'Accommodation', 'Daily Allowance', 'Food & Refreshment', 'Incentives',
        'Medical Expenses', 'Registration fee', 'Staff Welfare', 'Travel Allowance',
    ],
    'Student Empowerment': [
        'Accommodation', 'Certification Costs', 'Food & Refreshment', 'Incentives',
        'Medical Expense', 'Prizes', 'Registration fee', 'Student Uniform',
        'Student Welfare', 'Travel Support',
    ],
    'Student Capacity Building': [
        'ApptitudeTraining', 'Aptitude Training', 'Certification Programs',
        'Competitive Exam Coaching', 'Exposure Visit', 'Higher Education Coaching',
        'International Connect', 'Internship', 'Language Proficiency Courses',
        'One Credit Course', 'Placement Drives', 'Placement Training',
        'Skill Development Training', 'Value Added Course', 'Others',
    ],
    'Ranking & Accreditation': [
        'NAAC Fees', 'NAAC Inspection', 'NBA Fees', 'NBA Inspection',
        'QS Ranking', 'SDG Ranking', 'Other Rankings',
    ],
    'Examination Expenses': [
        'Autonomous Exam Remuneration', 'CoE Staff Remuneration',
        'Degree Recommendation', 'Government Exam Remuneration',
        'Online Exam Remuneration', 'QP Setting Expenses',
    ],
    'Learning Resources': ['Text Books', 'E-Resources'],
    'Accreditation Expenses': [
        'NAAC Fees', 'NBA Fees', 'NAAC Inspection', 'NBA Inspection',
    ],
    'Professional Body Expenses': ['Membership Fees', 'Annual Fees'],
    'Awards & Recognition': [
        'Accommodation', 'Daily Allowance', 'Driver Beta', 'Food & Refreshment',
        'Printing', 'Registration fee', 'Stationery', 'Travel Allowance', 'Others',
    ],
    'Advertisement & Branding': ['Digital Promotion', 'News Paper Advertisement'],
    'Public Relations': [
        'Branding', 'Corporate Gift', 'CSR Activity', 'Press & Media',
        'Promotions', 'Sponsorship',
    ],
    Admissions: [
        'Consultant Charges', 'Field Visits', 'School Visits', 'Stalls',
        'Student Directory',
    ],
    'Research & Development': [
        'Consultancy', 'HI Contribution', 'Institute Research Fellowship',
        'Publication Support', 'Research Cenre Renewal', 'Research Grant',
        'Seed Fund (Consumables)', 'Seed Fund (IPR Charges)',
        'Seed Fund (Product Development)', 'Seed Fund (Testing)',
        'Seed Fund (Travel)',
    ],
    'Government Funded Projects': [
        'Accessories & Peripherals', 'Accommodation', 'Administrative Expenses',
        'Consumables', 'Equipment', 'Food & Refreshment', 'Honorarium',
        'Incidental Expenses', 'IT Infrastructure', 'Manpower', 'Memento & Gifts',
        'Miscellaneous', 'Overhead Expenses', 'Printing', 'Publicity & Promotion',
        'Software & Licenses', 'Stationery', 'Travel',
    ],
    'Government Funded Events': [
        'A/V Arrangements', 'Accessories', 'Accommodation', 'Auditing Charge',
        'Bag', 'Consumables', 'Decorations', 'Driver Bata', 'Event Logistics',
        'Food & Refreshment', 'Honorarium', 'Memento & Gifts', 'Miscellaneous',
        'Printing', 'Prizes', 'Promotions', 'Publication Charges',
        'Registration fee', 'Registration Kit', 'Remuneration', 'Sitting Fees',
        'Stationery', 'T-shirt', 'Travel',
    ],
    'Administrative Expenses': [
        'Affiliation Fees', 'AICTE Fees', 'Anna University Fees', 'Audit Fees',
        'Autonomous Charges', 'Awards & Recognitions', 'Consortium Fees',
        'DOTE Fees', 'DTCP Approval', 'Fee Fixation Expenses',
        'Flag Day Expenses', 'Inspection Expenses', 'Insurance Charges',
        'International Travel', 'Legal Expenses', 'License Renewal',
        'Licenses & Taxes', 'Office Expenses', 'Scholarship Expenses',
        'Spirit License', 'Stamp Charges', 'Testing Charges', 'Water Charges',
    ],
    'Licenses & Taxes': [
        'Building Tax', 'DTCP Approval', 'License Renewal', 'Property Tax',
        'Road Tax', 'Spirit License', 'Water Tax',
    ],
    Salary: [
        'Allowances', 'Emoluments', 'ESI Scheme', 'Monthly Salary',
        'Professional Payments', 'Provident Fund', 'Wages',
    ],
    'Bills & Payments': [
        'Diesel Expenses', 'Electricity Charges', 'Internet Charges',
        'Telephone Charges',
    ],
    'Miscellaneous Expenses': [
        'Audit Fees', 'Bank Charges', 'Bank Interest', 'Farm Expenses',
        'Fire Extinguisher', 'First Aid Kit Expenses', 'General Expenses',
        'Generator & Fuel', 'Guest House', 'House Keeping', 'Irrecovable Fee',
        'Laundry Service', 'Legal Expenses', 'Loan Processing Charges',
        'Office Expenses', 'RO Mineral Water', 'RO  Mineral Water',
        'Sewage Treatment', 'Others',
    ],
};

// ============================================
// HOAC SHARED (finance) — applies to whole HOAC group
// ============================================
const HOAC_SUBHEADS = {
    'Events & Competitions': [
        'A/V Arrangements', 'Accessories', 'Accommodation', 'Auditing Charge',
        'Bag', 'Consumables', 'Decorations', 'Driver Bata', 'Event Logistics',
        'Food & Refreshment', 'Honorarium', 'Memento & Gifts', 'Miscellaneous',
        'Printing', 'Prizes', 'Promotions', 'Publication Charges', 'Refund',
        'Registration fee', 'Registration Kit', 'Remuneration', 'Sitting Fees',
        'Stationery', 'T-Shirt', 'Travel', 'Others',
    ],
    'Meetings & Audits': [
        'Accessories', 'Accommodation', 'Auditing Charge', 'Driver Bata',
        'Food & Refreshment', 'Honorarium', 'Memento & Gifts', 'Miscellaneous',
        'Printing', 'Registration fee', 'Remuneration', 'Sitting Fees',
        'Stationery', 'Travel', 'Others',
    ],
};

async function seed() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        console.log('Seeding budget_heads...');
        const headIdByName = new Map();
        let headOrder = 0;
        for (const group of BUDGET_HEAD_GROUPS) {
            for (const headName of group.heads) {
                if (headIdByName.has(headName)) continue;
                const [existing] = await connection.query(
                    'SELECT id FROM budget_heads WHERE name = ?',
                    [headName],
                );
                if (existing.length > 0) {
                    headIdByName.set(headName, existing[0].id);
                    continue;
                }
                const [result] = await connection.query(
                    'INSERT INTO budget_heads (name, group_label, sort_order) VALUES (?, ?, ?)',
                    [headName, group.label, headOrder++],
                );
                headIdByName.set(headName, result.insertId);
            }
        }
        console.log(`  ${headIdByName.size} heads ensured.`);

        console.log('Seeding head-specific sub-heads...');
        let subHeadCount = 0;
        for (const [headName, subHeads] of Object.entries(SUB_HEAD_BY_HEAD)) {
            const headId = headIdByName.get(headName);
            if (!headId) {
                console.warn(`  Skipping sub-heads for unknown head: ${headName}`);
                continue;
            }
            const seen = new Set();
            let order = 0;
            for (const subHead of subHeads) {
                const key = subHead.trim();
                if (!key || seen.has(key)) continue;
                seen.add(key);
                const [existing] = await connection.query(
                    'SELECT id FROM budget_sub_heads WHERE name = ? AND head_id = ? AND scope = ?',
                    [key, headId, 'head-specific'],
                );
                if (existing.length > 0) continue;
                await connection.query(
                    `INSERT INTO budget_sub_heads
                     (name, head_id, scope, sort_order)
                     VALUES (?, ?, 'head-specific', ?)`,
                    [key, headId, order++],
                );
                subHeadCount++;
            }
        }
        console.log(`  ${subHeadCount} head-specific sub-heads inserted.`);

        console.log('Seeding HOAC shared sub-heads...');
        let hoacCount = 0;
        for (const [eventType, subHeads] of Object.entries(HOAC_SUBHEADS)) {
            let order = 0;
            for (const subHead of subHeads) {
                const [existing] = await connection.query(
                    `SELECT id FROM budget_sub_heads
                     WHERE name = ? AND scope = 'hoac-shared' AND event_type = ?`,
                    [subHead, eventType],
                );
                if (existing.length > 0) continue;
                await connection.query(
                    `INSERT INTO budget_sub_heads
                     (name, scope, event_type, sort_order)
                     VALUES (?, 'hoac-shared', ?, ?)`,
                    [subHead, eventType, order++],
                );
                hoacCount++;
            }
        }
        console.log(`  ${hoacCount} HOAC shared sub-heads inserted.`);

        await connection.commit();
        console.log('Budget catalog seed complete.');
    } catch (err) {
        await connection.rollback();
        console.error('Seed failed:', err);
        process.exitCode = 1;
    } finally {
        connection.release();
        process.exit();
    }
}

seed();
