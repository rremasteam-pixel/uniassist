export type Role = 'student' | 'teacher' | 'admin';

export interface Me {
  id: string; email: string; first_name: string; last_name: string; role: Role; locale: 'sq' | 'en'; phone?: string | null;
  student_number?: string; class_group?: string; program_sq?: string; program_en?: string;
  position?: string; office?: string | null; department_sq?: string; department_en?: string; created_at: string;
}
export interface Source { n: number; documentId: string; title: string; page: number | null; }
export interface Message { id: number; role: 'user' | 'assistant'; content: string; sources: Source[]; answered: boolean | null; created_at: string; pending?: boolean; }
export interface Conversation { id: string; title: string; course_id: number | null; updated_at: string; messages?: Message[]; }
export interface Course {
  id: number; code: string; name_sq: string; name_en: string; kind: 'general' | 'theory' | 'practice'; weekly_hours: number;
  description_sq?: string; description_en?: string; program_sq?: string; program_en?: string; department_sq?: string; department_en?: string;
  teachers: { id: string; name: string }[];
}
export interface Doc {
  id: string; title: string; visibility: 'public' | 'staff' | 'course'; course_id: number | null; course_sq?: string; course_en?: string;
  original_name: string; mime_type: string; size_bytes: number; page_count: number | null; status: 'processing' | 'ready' | 'failed';
  error?: string | null; is_active: boolean; source_url?: string | null; created_at: string; category: string; category_sq: string;
  category_en: string; category_id: number; uploaded_by?: string; uploaded_by_id?: string; chunks: number;
}
