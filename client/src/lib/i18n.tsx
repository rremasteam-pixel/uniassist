import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'sq' | 'en';

const dict = {
  appTagline: { sq: 'Asistenti AI i shkollës "Beqir Çela"', en: 'AI assistant of "Beqir Çela" school' },
  login: { sq: 'Hyr', en: 'Sign in' }, logout: { sq: 'Dil', en: 'Sign out' }, register: { sq: 'Regjistrohu', en: 'Register' },
  email: { sq: 'Email', en: 'Email' }, password: { sq: 'Fjalëkalimi', en: 'Password' },
  firstName: { sq: 'Emri', en: 'First name' }, lastName: { sq: 'Mbiemri', en: 'Last name' },
  role: { sq: 'Roli', en: 'Role' }, student: { sq: 'Nxënës', en: 'Student' }, teacher: { sq: 'Mësues', en: 'Teacher' }, admin: { sq: 'Administrator', en: 'Administrator' },
  classGroup: { sq: 'Klasa', en: 'Class' }, department: { sq: 'Departamenti', en: 'Department' },
  noAccount: { sq: 'Nuk keni llogari?', en: "Don't have an account?" }, haveAccount: { sq: 'Keni llogari?', en: 'Have an account?' },
  demoAccounts: { sq: 'Llogari demo', en: 'Demo accounts' },
  pwHint: { sq: 'Të paktën 8 karaktere, me shkronja dhe numra.', en: 'At least 8 characters, letters and digits.' },
  dashboard: { sq: 'Paneli', en: 'Dashboard' }, assistant: { sq: 'Asistenti AI', en: 'AI Assistant' },
  courses: { sq: 'Lëndët e mia', en: 'My courses' }, schedule: { sq: 'Orari', en: 'Schedule' }, exams: { sq: 'Kalendari i provimeve', en: 'Exam calendar' },
  documents: { sq: 'Dokumentet', en: 'Documents' }, notifications: { sq: 'Njoftimet', en: 'Notifications' }, profile: { sq: 'Profili', en: 'Profile' },
  announcements: { sq: 'Lajmërimet', en: 'Announcements' }, questions: { sq: 'Pyetjet e nxënësve', en: 'Student questions' },
  directory: { sq: 'Departamente & stafi', en: 'Departments & staff' }, users: { sq: 'Përdoruesit', en: 'Users' }, search: { sq: 'Kërko', en: 'Search' },
  searchPlaceholder: { sq: 'Kërko lëndë, mësues, dokumente…', en: 'Search courses, teachers, documents…' },
  newChat: { sq: 'Bisedë e re', en: 'New chat' }, history: { sq: 'Historiku', en: 'History' },
  askPlaceholder: { sq: 'Bëni një pyetje rreth shkollës…', en: 'Ask a question about the school…' },
  send: { sq: 'Dërgo', en: 'Send' }, thinking: { sq: 'Duke kërkuar në dokumente…', en: 'Searching documents…' },
  source: { sq: 'Burimi', en: 'Source' }, page: { sq: 'faqe', en: 'page' },
  notFoundBadge: { sq: 'Informacion i padisponueshëm', en: 'Information unavailable' },
  chatIntro: { sq: 'Përgjigjet bazohen vetëm në dokumentet zyrtare të shkollës. Kur informacioni mungon, asistenti e thotë qartë.', en: 'Answers are based only on official school documents. When information is missing, the assistant says so.' },
  suggestions: { sq: 'Pyetje të shpeshta', en: 'Suggested questions' },
  courseContext: { sq: 'Konteksti i lëndës', en: 'Course context' }, general: { sq: 'Të përgjithshme', en: 'General' },
  deleteChat: { sq: 'Fshi bisedën', en: 'Delete chat' },
  upload: { sq: 'Ngarko dokument', en: 'Upload document' }, replace: { sq: 'Zëvendëso', en: 'Replace' }, delete: { sq: 'Fshi', en: 'Delete' },
  reprocess: { sq: 'Ripërpuno', en: 'Reprocess' }, open: { sq: 'Hap', en: 'Open' }, title: { sq: 'Titulli', en: 'Title' },
  category: { sq: 'Kategoria', en: 'Category' }, visibility: { sq: 'Dukshmëria', en: 'Visibility' }, file: { sq: 'Skedari', en: 'File' },
  uploaded: { sq: 'Ngarkuar', en: 'Uploaded' }, status: { sq: 'Statusi', en: 'Status' }, all: { sq: 'Të gjitha', en: 'All' },
  public: { sq: 'Publik', en: 'Public' }, staff: { sq: 'Vetëm stafi', en: 'Staff only' }, course: { sq: 'Lëndë', en: 'Course' },
  ready: { sq: 'Gati', en: 'Ready' }, processing: { sq: 'Në përpunim', en: 'Processing' }, failed: { sq: 'Dështoi', en: 'Failed' },
  inactive: { sq: 'Version i vjetër', en: 'Superseded' }, showInactive: { sq: 'Shfaq versionet e vjetra', en: 'Show superseded' },
  cancel: { sq: 'Anulo', en: 'Cancel' }, save: { sq: 'Ruaj', en: 'Save' }, create: { sq: 'Krijo', en: 'Create' }, confirmDelete: { sq: 'Jeni të sigurt?', en: 'Are you sure?' },
  empty: { sq: 'Nuk ka asgjë këtu ende.', en: 'Nothing here yet.' }, error: { sq: 'Diçka shkoi keq.', en: 'Something went wrong.' }, retry: { sq: 'Provo sërish', en: 'Retry' },
  students: { sq: 'Nxënës', en: 'Students' }, teachers: { sq: 'Mësues', en: 'Teachers' }, coursesCount: { sq: 'Lëndë', en: 'Courses' },
  docsCount: { sq: 'Dokumente', en: 'Documents' }, conversations: { sq: 'Biseda me AI', en: 'AI conversations' },
  faq: { sq: 'Pyetjet më të shpeshta', en: 'Most frequent questions' }, recentUsers: { sq: 'Përdoruesit e fundit', en: 'Recent users' },
  recentDocs: { sq: 'Ngarkimet e fundit', en: 'Recent uploads' }, unanswered: { sq: 'Pyetje pa përgjigje (mungon dokumenti)', en: 'Unanswered (missing documentation)' },
  activity: { sq: 'Pyetje në 14 ditët e fundit', en: 'Questions, last 14 days' },
  nextExam: { sq: 'Provimi i radhës', en: 'Next exam' }, unread: { sq: 'Njoftime të palexuara', en: 'Unread notifications' },
  hello: { sq: 'Përshëndetje', en: 'Hello' }, quickAsk: { sq: 'Pyet asistentin', en: 'Ask the assistant' },
  demoData: { sq: 'Të dhëna demo', en: 'Demo data' }, weekdays: { sq: 'E hënë,E martë,E mërkurë,E enjte,E premte', en: 'Monday,Tuesday,Wednesday,Thursday,Friday' },
  room: { sq: 'Salla', en: 'Room' }, markAllRead: { sq: 'Shëno të gjitha si të lexuara', en: 'Mark all read' },
  newAnnouncement: { sq: 'Lajmërim i ri', en: 'New announcement' }, body: { sq: 'Përmbajtja', en: 'Body' }, schoolWide: { sq: 'Gjithë shkolla', en: 'School-wide' },
  phone: { sq: 'Telefoni', en: 'Phone' }, office: { sq: 'Zyra', en: 'Office' }, language: { sq: 'Gjuha', en: 'Language' },
  changePassword: { sq: 'Ndrysho fjalëkalimin', en: 'Change password' }, currentPassword: { sq: 'Fjalëkalimi aktual', en: 'Current password' }, newPassword: { sq: 'Fjalëkalimi i ri', en: 'New password' },
  saved: { sq: 'U ruajt', en: 'Saved' }, results: { sq: 'Rezultatet', en: 'Results' }, programs: { sq: 'Drejtimet', en: 'Programs' },
  answered: { sq: 'Përgjigjur', en: 'Answered' }, notAnswered: { sq: 'Pa përgjigje', en: 'Not answered' },
  active: { sq: 'Aktiv', en: 'Active' }, deactivate: { sq: 'Çaktivizo', en: 'Deactivate' }, activate: { sq: 'Aktivizo', en: 'Activate' },
  hoursWeek: { sq: 'orë/javë', en: 'h/week' }, theory: { sq: 'Teori', en: 'Theory' }, practice: { sq: 'Praktikë', en: 'Practice' }, generalEd: { sq: 'Kulturë e përgjithshme', en: 'General education' },
  officialSource: { sq: 'Burimi zyrtar', en: 'Official source' }, askAboutCourse: { sq: 'Pyet për këtë lëndë', en: 'Ask about this course' },
  loading: { sq: 'Duke ngarkuar…', en: 'Loading…' }, notFoundPage: { sq: 'Faqja nuk u gjet', en: 'Page not found' },
} as const;

export type Key = keyof typeof dict;
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'sq');
  const setLang = (l: Lang) => { localStorage.setItem('lang', l); document.documentElement.lang = l; setLangState(l); };
  const t = (k: Key) => dict[k][lang];
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);

/** Pick `name_sq` / `name_en` style field */
export const pick = (o: any, base: string, lang: Lang) => o?.[`${base}_${lang}`] ?? o?.[`${base}_sq`] ?? '';
export const fmtDate = (d: string | Date, lang: Lang, withTime = false) =>
  new Date(d).toLocaleString(lang === 'sq' ? 'sq-AL' : 'en-GB',
    withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
