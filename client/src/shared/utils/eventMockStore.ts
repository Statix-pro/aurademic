import { AxiosRequestConfig, AxiosResponse, getAdapter } from 'axios';

// TypeScript interfaces matching events.tsx requirements
export interface MockSubEvent {
  id: number;
  title: string;
  status: string;
  proposedBy: string;
  category: string;
  department: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  venue: string;
  parent_id: number;
}

export interface MockMainEvent {
  id: number;
  title: string;
  status: string;
  proposedBy: string;
  category: string;
  department: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  venue: string;
  isMultiEvent: number;
  parent_id: number | null;
  sub_events?: MockSubEvent[];
}

export interface MockParticipant {
  id: number;
  name: string;
  institution: string;
  category: string;
  status: string;
  hasTeam: boolean;
  hasDoc: boolean;
  documentUrl: string | null;
  accommodation_required: number;
  hostel: string;
  fees: number;
  fee_status: string;
  action1?: string;
  action2?: string;
  action3?: string;
}

export interface MockDocState {
  docname: string;
  active: boolean;
}

// Initial mock data
const INITIAL_EVENTS: MockMainEvent[] = [
  {
    id: 1,
    title: 'National Symposium on Cloud Computing',
    status: 'Approved',
    proposedBy: 'Dr. Ramesh Kumar',
    category: 'Symposium',
    department: 'Computer Science',
    date: '2026-10-15T09:30:00.000Z',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    venue: 'Cyberdome',
    isMultiEvent: 0,
    parent_id: null,
  },
  {
    id: 2,
    title: 'AI/ML Workshop for Beginners',
    status: 'Pending',
    proposedBy: 'Ms Vijayapriya C',
    category: 'Workshop',
    department: 'EE (VLSI D&T)',
    date: '2026-10-07T09:00:00.000Z',
    createdAt: '2026-08-22T09:00:00.000Z',
    updatedAt: '2026-08-22T09:00:00.000Z',
    venue: 'Innovation Lab',
    isMultiEvent: 1,
    parent_id: null,
    sub_events: [
      {
        id: 5,
        title: 'Deep Learning & Neural Networks Session',
        status: 'Pending',
        proposedBy: 'Ms Vijayapriya C',
        category: 'Workshop',
        department: 'EE (VLSI D&T)',
        date: '2026-10-07T14:00:00.000Z',
        createdAt: '2026-08-22T09:30:00.000Z',
        updatedAt: '2026-08-22T09:30:00.000Z',
        venue: 'Innovation Lab',
        parent_id: 2,
      },
    ],
  },
  {
    id: 3,
    title: 'IoT Hackathon 2026',
    status: 'Draft',
    proposedBy: 'Mr. Suresh Pillai',
    category: 'Competition',
    department: 'Mechanical Engineering',
    date: '2026-11-20T08:00:00.000Z',
    createdAt: '2026-08-24T11:00:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z',
    venue: 'Seminar Hall 1',
    isMultiEvent: 0,
    parent_id: null,
  },
  {
    id: 4,
    title: 'Blockchain Masterclass',
    status: 'Return',
    proposedBy: 'Dr. Anita Roy',
    category: 'Seminar',
    department: 'Computer Science',
    date: '2026-09-05T10:00:00.000Z',
    createdAt: '2026-08-18T14:00:00.000Z',
    updatedAt: '2026-08-18T14:00:00.000Z',
    venue: 'Main Auditorium',
    isMultiEvent: 0,
    parent_id: null,
  },
];

const DEFAULT_DOCUMENTS = [
  'Proposal',
  'Budget',
  'Brochure',
  'Resource Persons',
  'Participants',
  'Feedback',
  'Photos',
  'Report',
];

const INITIAL_PARTICIPANTS: Record<number, MockParticipant[]> = {
  1: [
    {
      id: 101,
      name: 'Adarsh Sen',
      institution: 'KSRCT CSE',
      category: 'Student',
      status: 'Approved',
      hasTeam: false,
      hasDoc: true,
      documentUrl: 'mock_doc_path_1.pdf',
      accommodation_required: 1,
      hostel: 'Approved',
      fees: 500,
      fee_status: 'Approved',
    },
    {
      id: 102,
      name: 'Dr. Priya Sharma',
      institution: 'PSG Tech',
      category: 'Faculty',
      status: 'Approved',
      hasTeam: false,
      hasDoc: false,
      documentUrl: null,
      accommodation_required: 0,
      hostel: 'Pending',
      fees: 1000,
      fee_status: 'Approved',
    },
  ],
  2: [
    {
      id: 201,
      name: 'Gaurav Kumar',
      institution: 'KSRCT EEE',
      category: 'Student',
      status: 'Registered',
      hasTeam: true,
      hasDoc: true,
      documentUrl: 'mock_doc_path_2.pdf',
      accommodation_required: 1,
      hostel: 'Pending',
      fees: 250,
      fee_status: 'Pending',
    },
  ],
};

// Storage helper functions
const getStoreEvents = (): MockMainEvent[] => {
  const data = localStorage.getItem('aurademic_mock_events');
  if (!data) {
    localStorage.setItem('aurademic_mock_events', JSON.stringify(INITIAL_EVENTS));
    return INITIAL_EVENTS;
  }
  return JSON.parse(data);
};

const saveStoreEvents = (events: MockMainEvent[]) => {
  localStorage.setItem('aurademic_mock_events', JSON.stringify(events));
};

const getStoreDocs = (eventId: number): MockDocState[] => {
  const key = `aurademic_mock_docs_${eventId}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const docs = DEFAULT_DOCUMENTS.map((doc) => ({
      docname: doc,
      active: doc === 'Proposal' || doc === 'Budget', // Default active ones
    }));
    localStorage.setItem(key, JSON.stringify(docs));
    return docs;
  }
  return JSON.parse(data);
};

const saveStoreDocs = (eventId: number, docs: MockDocState[]) => {
  localStorage.setItem(`aurademic_mock_docs_${eventId}`, JSON.stringify(docs));
};

const getStoreParticipants = (eventId: number): MockParticipant[] => {
  const key = `aurademic_mock_participants_${eventId}`;
  const data = localStorage.getItem(key);
  if (!data) {
    const initial = INITIAL_PARTICIPANTS[eventId] || [];
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveStoreParticipants = (eventId: number, participants: MockParticipant[]) => {
  localStorage.setItem(`aurademic_mock_participants_${eventId}`, JSON.stringify(participants));
};

// Request Mock Router
export async function handleEventMock(config: AxiosRequestConfig): Promise<any> {
  const rawUrl = config.url || '';
  const url = rawUrl.replace(/^\/api/, ''); // Strip '/api' if present
  const cleanUrl = url.split('?')[0];
  const parts = cleanUrl.split('/').filter(Boolean); // e.g. ['events', '1', 'summary']
  const method = (config.method || 'get').toLowerCase();

  const getBody = () => {
    if (!config.data) return {};
    return typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  };

  // 1. /events routing
  if (parts[0] === 'events') {
    // GET /events
    if (parts.length === 1 && method === 'get') {
      const events = getStoreEvents();
      return events.filter((e) => !(e as any).is_deleted);
    }

    // POST /events
    if (parts.length === 1 && method === 'post') {
      const body = getBody();
      const events = getStoreEvents();
      const newId = events.reduce((max, e) => Math.max(max, e.id), 0) + 1;

      const newEvent: MockMainEvent = {
        id: newId,
        title: body.title || 'Untitled Event',
        status: 'Draft',
        proposedBy: 'Current User',
        category: body.category || 'N/A',
        department: 'CS',
        date: body.start_date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        venue: body.venue || 'TBD',
        isMultiEvent: body.is_multi_event ? 1 : 0,
        parent_id: body.parent_id || null,
      };

      if (newEvent.parent_id) {
        // Add as sub-event to the parent in store
        const updated = events.map((parent) => {
          if (parent.id === newEvent.parent_id) {
            const subs = parent.sub_events || [];
            const subEvent: MockSubEvent = {
              id: newId,
              title: newEvent.title,
              status: newEvent.status,
              proposedBy: newEvent.proposedBy,
              category: newEvent.category,
              department: newEvent.department,
              date: newEvent.date,
              createdAt: newEvent.createdAt,
              updatedAt: newEvent.updatedAt,
              venue: newEvent.venue,
              parent_id: parent.id,
            };
            return { ...parent, sub_events: [...subs, subEvent] };
          }
          return parent;
        });
        saveStoreEvents(updated);
      } else {
        events.push(newEvent);
        saveStoreEvents(events);
      }

      return newEvent;
    }

    // PUT /events/:id
    if (parts.length === 2 && method === 'put') {
      const id = parseInt(parts[1], 10);
      const body = getBody();
      const events = getStoreEvents();

      let targetEvent: MockMainEvent | null = null;

      const updatedEvents = events.map((evt) => {
        if (evt.id === id) {
          targetEvent = {
            ...evt,
            title: body.title || evt.title,
            category: body.category || evt.category,
            date: body.start_date || evt.date,
            venue: body.venue || evt.venue,
            isMultiEvent: body.is_multi_event ? 1 : 0,
            updatedAt: new Date().toISOString(),
          };
          return targetEvent;
        }

        // Check inside sub_events
        if (evt.sub_events && evt.sub_events.length > 0) {
          const updatedSubs = evt.sub_events.map((sub) => {
            if (sub.id === id) {
              const updatedSub = {
                ...sub,
                title: body.title || sub.title,
                category: body.category || sub.category,
                date: body.start_date || sub.date,
                venue: body.venue || sub.venue,
                updatedAt: new Date().toISOString(),
              };
              targetEvent = updatedSub as any;
              return updatedSub;
            }
            return sub;
          });
          return { ...evt, sub_events: updatedSubs };
        }

        return evt;
      });

      saveStoreEvents(updatedEvents);
      return targetEvent || { id, ...body };
    }

    // DELETE /events/:id
    if (parts.length === 2 && method === 'delete') {
      const id = parseInt(parts[1], 10);
      const events = getStoreEvents();

      const updatedEvents = events
        .map((evt) => {
          if (evt.id === id) {
            return { ...evt, is_deleted: 1 } as any;
          }
          if (evt.sub_events) {
            const subs = evt.sub_events.filter((sub) => sub.id !== id);
            return { ...evt, sub_events: subs };
          }
          return evt;
        })
        .filter((evt) => !(evt as any).is_deleted);

      saveStoreEvents(updatedEvents);
      return { success: true };
    }

    // GET /events/:id/summary
    if (parts.length === 3 && parts[2] === 'summary' && method === 'get') {
      const id = parseInt(parts[1], 10);
      const events = getStoreEvents();

      let found: any = null;
      for (const e of events) {
        if (e.id === id) {
          found = e;
          break;
        }
        if (e.sub_events) {
          const sub = e.sub_events.find((s) => s.id === id);
          if (sub) {
            found = sub;
            break;
          }
        }
      }

      if (!found) throw { status: 404, message: 'Event not found' };

      return {
        id: found.id,
        title: found.title,
        status: found.status,
        date: found.date,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
      };
    }

    // GET /events/:id/participants
    if (parts.length === 3 && parts[2] === 'participants' && method === 'get') {
      const eventId = parseInt(parts[1], 10);
      const participants = getStoreParticipants(eventId);
      return { participants };
    }

    // PUT /events/:eventId/participants/:pid
    if (parts.length === 4 && parts[2] === 'participants' && method === 'put') {
      const eventId = parseInt(parts[1], 10);
      const pid = parseInt(parts[3], 10);
      const body = getBody();

      const participants = getStoreParticipants(eventId);
      const updated = participants.map((p) => {
        if (p.id === pid) {
          return {
            ...p,
            ...body,
          };
        }
        return p;
      });

      saveStoreParticipants(eventId, updated);
      return { success: true };
    }

    // POST /events/:id/feedback
    if (parts.length === 3 && parts[2] === 'feedback' && method === 'post') {
      return { success: true };
    }
  }

  // 2. /documents routing
  if (parts[0] === 'documents') {
    // GET /documents/:eventId
    if (parts.length === 2 && method === 'get') {
      const eventId = parseInt(parts[1], 10);
      const docs = getStoreDocs(eventId);
      return { documents: docs, participants: [] };
    }

    // PUT /documents/:eventId/doc/:docname
    if (parts.length === 4 && parts[2] === 'doc' && method === 'put') {
      const eventId = parseInt(parts[1], 10);
      const docname = decodeURIComponent(parts[3]);
      const body = getBody();

      const docs = getStoreDocs(eventId);
      const updated = docs.map((d) => {
        if (d.docname === docname) {
          return { ...d, active: body.active };
        }
        return d;
      });

      saveStoreDocs(eventId, updated);
      return { success: true };
    }

    // POST /documents/:eventId/doc/:docname/upload
    if (parts.length === 5 && parts[2] === 'doc' && parts[4] === 'upload' && method === 'post') {
      return { success: true, file_path: 'mock_document_file.pdf' };
    }

    // POST /documents/:eventId/edit-request
    if (parts.length === 3 && parts[2] === 'edit-request' && method === 'post') {
      const eventId = parseInt(parts[1], 10);
      const events = getStoreEvents();

      const updated = events.map((e) => {
        if (e.id === eventId) {
          return { ...e, status: 'Return' };
        }
        if (e.sub_events) {
          const subs = e.sub_events.map((s) => (s.id === eventId ? { ...s, status: 'Return' } : s));
          return { ...e, sub_events: subs };
        }
        return e;
      });

      saveStoreEvents(updated);
      return { success: true };
    }

    // POST /documents/:eventId/submit
    if (parts.length === 3 && parts[2] === 'submit' && method === 'post') {
      const eventId = parseInt(parts[1], 10);
      const events = getStoreEvents();

      const updated = events.map((e) => {
        if (e.id === eventId) {
          return { ...e, status: 'Pending' };
        }
        if (e.sub_events) {
          const subs = e.sub_events.map((s) =>
            s.id === eventId ? { ...s, status: 'Pending' } : s,
          );
          return { ...e, sub_events: subs };
        }
        return e;
      });

      saveStoreEvents(updated);
      return { success: true };
    }
  }

  // 3. /updates routing
  if (parts[0] === 'updates' && parts[1] === 'events') {
    // POST /updates/events/:id/uploads
    if (parts.length === 4 && parts[3] === 'uploads' && method === 'post') {
      return { success: true, file_path: 'mock_update_file.pdf' };
    }

    // PUT /updates/events/:id/publicity
    // POST /updates/events/:id/participants
    // PUT /updates/events/:id/letters
    // PUT /updates/events/:id/documents
    if (
      parts.length === 4 &&
      (parts[3] === 'publicity' ||
        parts[3] === 'participants' ||
        parts[3] === 'letters' ||
        parts[3] === 'documents') &&
      (method === 'put' || method === 'post')
    ) {
      return { success: true };
    }

    // Resource Persons endpoints
    if (parts[3] === 'resource_persons') {
      // POST /updates/events/:id/resource_persons
      if (parts.length === 4 && method === 'post') {
        const body = getBody();
        return { success: true, id: Date.now(), ...body };
      }

      // PUT /updates/events/:id/resource_persons/:pid
      if (parts.length === 5 && method === 'put') {
        return { success: true };
      }

      // DELETE /updates/events/:id/resource_persons/:pid
      if (parts.length === 5 && method === 'delete') {
        return { success: true };
      }
    }
  }

  // 4. /finance routing
  if (parts[0] === 'finance') {
    if (parts.length === 1 && method === 'post') {
      return { success: true, id: Date.now() };
    }
  }

  throw { status: 404, message: `Route mock not found: ${method} ${cleanUrl}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock interceptor toggle
// Set ENABLE_EVENT_MOCK to true to use localStorage mock data instead of the
// real backend (useful when running the client without a local server).
// ─────────────────────────────────────────────────────────────────────────────
const ENABLE_EVENT_MOCK = false;

// Router matching helper – returns false when mock is disabled so every request
// falls through to the real Express backend.
function isEventRoute(url: string): boolean {
  if (!ENABLE_EVENT_MOCK) return false; // <-- Live backend mode

  const cleanUrl = url.split('?')[0]; // Remove query params for matching
  return (
    cleanUrl === '/events' ||
    cleanUrl.startsWith('/events/') ||
    cleanUrl === '/documents' ||
    cleanUrl.startsWith('/documents/') ||
    (cleanUrl.startsWith('/finance') && !cleanUrl.startsWith('/finance-requests')) ||
    cleanUrl === '/pre-events' ||
    cleanUrl.startsWith('/pre-events/') ||
    cleanUrl.startsWith('/updates/events/')
  );
}

// Axios Adapter Application
export function applyEventMockAdapter(instance: any) {
  const originalAdapter = instance.defaults.adapter;

  instance.defaults.adapter = async (config: AxiosRequestConfig): Promise<AxiosResponse<any>> => {
    const url = config.url || '';

    if (isEventRoute(url)) {
      try {
        const mockData = await handleEventMock(config);
        return {
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {} as any,
          config: config as any,
        };
      } catch (err: any) {
        return Promise.reject({
          config,
          response: {
            data: { error: err.message || 'Mock Error' },
            status: err.status || 500,
            statusText: 'Internal Server Error',
            headers: {},
            config: config as any,
          },
        });
      }
    }

    if (originalAdapter) {
      const resolvedAdapter =
        typeof originalAdapter === 'function'
          ? originalAdapter
          : getAdapter
            ? getAdapter(originalAdapter)
            : null;

      if (resolvedAdapter) {
        return resolvedAdapter(config);
      }
    }

    throw new Error('No adapter available');
  };
}
