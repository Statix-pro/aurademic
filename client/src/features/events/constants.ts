export const EVENT_DASHBOARD_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const DUMMY_EVENTS = [
  {
    status: "pending",
    proposedBy: "Ms Vijayapriya C",
    category: "Workshop",
    department: "EE (VLSI D&T)",
    time: "09:00 AM - 12:30 PM",
    name: "3D Printing Materials Mechanical Engineering Mechanical Engineering Mechanical Engineering",
    venue: "Cyberdome",
    date: "2026-10-07",
  },
  {
    status: "approved",
    proposedBy: "Ms Vijayapriya C",
    category: "Seminar",
    department: "Computer Science",
    time: "01:00 PM - 03:00 PM",
    name: "AI in Industry 4.0",
    venue: "Innovation Lab",
    date: "2026-10-09",
  },
  {
    status: "rejected",
    proposedBy: "Ms Vijayapriya C",
    category: "Competition",
    department: "SM Volunteers",
    time: "03:30 PM - 05:30 PM",
    name: "Robotics Challenge",
    venue: "Robotics Lab",
    date: "2026-10-07",
  },
  {
    status: "archived",
    proposedBy: "Ms Vijayapriya C",
    category: "Workshop",
    department: "Civil",
    time: "10:00 AM - 01:00 PM",
    name: "Sustainable Materials",
    venue: "Auditorium",
    date: "2026-10-12",
  },
];

export const EVENT_APPROVAL_FEE_MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

export const EVENT_APPROVAL_OPTIONS = {
  categories: ["Technical", "Non-Technical", "Cultural", "Sports"],
  types: [
    "Conference",
    "Seminar",
    "Workshop",
    "Symposium",
    "Training",
    "Webinar",
    "Hackathon",
    "FDP",
  ],
  levels: [
    "Intra College",
    "Inter College",
    "District",
    "State",
    "National",
    "International",
  ],
  participants: [
    "Students",
    "Faculty",
    "Research Scholars",
    "Industry",
    "Public",
  ],
  theme: [
    "Innovation",
    "Sustainability",
    "Digital Transformation",
    "Research",
    "Industry Collaboration",
  ],
  sdg: [
    "SDG 1",
    "SDG 2",
    "SDG 3",
    "SDG 4",
    "SDG 5",
    "SDG 6",
    "SDG 7",
    "SDG 8",
    "SDG 9",
    "SDG 10",
  ],
  mode: ["Physical", "Virtual", "Hybrid"],
  venue: [
    "Cyberdome",
    "Visveshwaraya Hall",
    "Biotech Seminar Hall",
    "ECC Seminar Hall",
    "Founder Hall",
    "Idea Lab",
  ],
  status: ["Ongoing", "Closed"],
  participantCategory: [
    "Students",
    "Faculty",
    "External",
    "Research Scholars",
  ],
  documentName: ["ID Card", "Bonafide Certificate", "Payment Receipt"],
  documentType: ["PDF", "Image", "Document"],
  documentSize: ["1 MB", "2 MB", "5 MB"],
  collaboratorType: [
    "Institution",
    "Department",
    "Professional Body",
    "Cell/Club",
  ],
  coordinator: ["Coordinator 1", "Coordinator 2", "Coordinator 3"],
};

export const EVENT_SESSION_OPTIONS = ["FN", "AN", "Full Day"];
export const EVENT_OPEN_TO_OPTIONS = ["Any", "Internal", "External"];
export const EVENT_GENDER_RESTRICTION_OPTIONS = ["Any", "Male", "Female"];
export const EVENT_ACCOMMODATION_TYPE_OPTIONS = ["Free", "Paid"];
export const EVENT_PAGE_TABS = [
  { id: "pre-event", label: "Pre Event Approvals" },
  { id: "finance", label: "Finance" },
  { id: "updates", label: "Event Updates" },
  { id: "participants", label: "Participants" },
  { id: "feedback", label: "Feedback" },
] as const;

export const EVENT_FEEDBACK_TOGGLES = ["food", "refreshment", "presentation", "evaluation", "enjoyment"] as const;
export const EVENT_FEEDBACK_AWARENESS_CHANNELS = [
  "Circular",
  "Social Media",
  "Email",
  "Friends",
  "Website",
  "Colleagues",
  "Others",
] as const;
export const EVENT_RESOURCE_PERSON_OPTIONS = [
  "Dr. A. Kumar, Department of Computer Science",
  "Dr. S. Priya, Department of Electronics",
  "Ms. R. Anitha, Industry Expert",
  "Mr. K. Vinoth, Research & Innovation",
] as const;

export const EVENT_COPY = {
  chooseFile: "Choose File",
  select: "Select",
  selectParticipantType: "-- Select Participant Type --",
  selectMainEvent: "Select Main Event",
  noMainEventsAvailable: "No Main Events available with Multi Event enabled.",
  feedbackLink: "Feedback Link",
  totalParticipants: "Total Participants",
  submitFeedback: "Submit Feedback",
  submitNext: "Submit & Next",
  socialMedia: "Social Media",
  resourcePersonLabel: "Resource Person:",
  notSent: "Not Sent",
  scheduleVenue: "Schedule & Venue",
  registrationSettings: "Registration Settings",
  accommodation: "Accommodation",
  expectedParticipants: "Expected Participants",
  noOfDays: "No. of Days",
  add: "Add +",
  save: "Save",
  preview: "Preview",
  sendMail: "Send Mail",
  lettersTitle: "Letters",
  participantsTitle: "Participants",
  documentsTitle: "Documents",
  importantLinksTitle: "Important Links",
  loadingParticipants: "Loading participants...",
  noParticipantsFound: "No participants found.",
  totalParticipantsLabel: "Total Participants",
  feedbackLinkLabel: "Feedback Link",
  enterFeedbackLink: "Enter feedback link",
  eventFeedbackTitle: "Event:",
  accommodationTitle: "Accommodation",
  noMainEventOption: "-- Select an Event --",
  selectMainEventError: "Select Main Event",
  resourcePersonPrefix: "Resource Person",
  invitationLabel: "Invitation",
  thanksLabel: "Thanks",
  previewInvitation: "Previewing Invitation for",
  previewThanks: "Previewing Thank You letter for",
  topicPlaceholder: "Topic / Title of presentation...",
  publicityTitle: "Publicity",
  socialMediaLinksTitle: "Social Media Links",
  websiteScrolling: "Website Scrolling",
  newspaperEngagement: "Newspaper Engagement",
  pressReport: "Press Report",
  facebookLink: "Facebook link",
  xLink: "X link",
  instagramLink: "Instagram link",
  linkedinLink: "Linkedin link",
  eventFlyer: "Event Flyer",
  eventName: "Event Name",
  chooseFile: "Choose File",
  noOfDaysLabel: "No. of Days",
  scheduleVenueLabel: "Schedule & Venue",
  registrationSettingsLabel: "Registration Settings",
  accommodationLabel: "Accommodation",
  expectedParticipantsLabel: "Expected Participants",
} as const;

export const EVENT_MAIL_TEMPLATES = {
  invitationSubject: (name: string) => `Invitation to be Resource Person`,
  invitationBody: (name: string) =>
    `Dear ${name || "Sir/Madam"},\n\nWe would like to invite you as a resource person...`,
  thankYouSubject: () => `Thank you for being Resource Person`,
  thankYouBody: (name: string) =>
    `Dear ${name || "Sir/Madam"},\n\nThank you for sharing your expertise...`,
} as const;

export const FINANCE_INCOME_HEADS = [
  "Registration Fee",
  "Sponsorship",
  "Management Contribution",
  "Others",
];

export const FINANCE_BUDGET_HEADS = [
  "Honorarium",
  "Travel",
  "Printing",
  "Stationary",
  "Food",
  "Refreshment",
  "Others",
];

export const FINANCE_INITIAL_DOCS = [
  "Sanction Order",
  "Utilization Certificate",
  "Bank Statement",
  "Statement of Expenditure",
];

export const EVENT_UPDATE_LETTERS_SECTIONS = [
  "Security Division",
  "Photography",
  "Video Recording",
];

export const DOCUMENT_PARTICIPANT_TYPES = [
  { value: "internal-students", label: "Internal Students" },
  { value: "external-students", label: "External Students" },
  { value: "faculty", label: "Faculty Members" },
  { value: "research-scholars", label: "Research Scholars" },
  { value: "industry-experts", label: "Industry Experts" },
  { value: "alumni", label: "Alumni" },
  { value: "general-public", label: "General Public" },
];

export const EVENT_DOCUMENTS = [
  "Invitation",
  "Agenda",
  "Schedule",
  "Report",
  "Attendance sheet",
  "Sample Certificate",
  "Photos",
];
