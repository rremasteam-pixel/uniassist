/**
 * Seeds the database with:
 *  - REAL public information from beqircela.edu.al (departments, programs, leadership, staff 2024–2025, KB documents)
 *  - DEMO data (class groups, courses, timetables, exams, demo login accounts) — clearly marked, never ingested
 *    into the knowledge base, so the assistant cannot present it as official.
 * Run: npm run db:init && npm run seed
 */
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { copyFile, readdir, writeFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { pool, query } from '../db.js';
import { config } from '../config.js';
import { ingestDocument } from '../services/ingest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = 'https://beqircela.edu.al';

// ── Real: Stafi mësimor 2024–2025 (https://beqircela.edu.al/?page_id=171) ──
const STAFF: [string, string, string][] = [
  ['Fatmir','Merkuri','drejtor'],['Roland','Dema','zv/drejtor'],['Etleva','Kacanja','zv/drejtor'],['Mimoza','Zhamo','zv/drejtor'],
  ['Euglent','Ceci','përgjegjës i bazës prodhuese'],
  ...['Alba Dervishi','Gurim Kaci','Dorina Murati','Marjeta Milloshi','Llambi Kallco','Jasmina Agaj','Matilda Vora','Ada Shtino','Heliona Licaj',
     'Olgerta Shaba','Floriana Stefani','Engjell Seferasi','Ismet Ismaili','Oltiana Balliu','Tiziana Lacku','Silvana Ferzaj','Hilmi Xhaferri',
     'Ymer Suçi','Ermir Fraholli','Jetlinda Krasniqi','Rivelino Feimi','Franc Kraja','Aida Himçi','Elvira Rruga','Altin Lika','Marsida Çiçolli',
     'Ada Zhuleku','Uljana Tepshi','Sidorela Seferi','Nertila Fraholli','Elvira Elezi','Kadrie Shtaro','Elda Xhunga']
     .map(n => [...n.split(' '), 'mësues'] as [string, string, string]),
  ...['Ermielda Koroveshi','Pranvera Rroshi','Kiara Xhumrra'].map(n => [...n.split(' '), 'mësuese me orë'] as [string, string, string]),
  ['Saimir','Laci','mësues teorie'],['Nazmi','Kasmi','mësues praktike'],['Manjola','Sharkaj','mësues teorie'],['Artur','Karruli','mësues teorie'],
  ['Koco','Dolani','mësues teorie'],['Marinela','Suçi','mësues praktike'],['Zinaida','Deda','mësues teorie'],['Klodiana','Mehja','mësues praktike'],
  ['Rudina','Tereziu','mësues teorie'],['Jovana','Hebibasi','mësues teorie'],['Markelian','Laho','mësues praktike'],['Altin','Minga','mësues praktike'],
  ['Roland','Ziaj','mësues praktike'],['Banush','Dollani','mësues praktike'],['Adelina','Çela','mësues teorie'],['Arta','Çafuli','mësues praktike'],
  ['Besjana','Kola','mësues teorie'],['Qazim','Xhameta','mësues teorie'],['Eva','Prenga','mësues teorie'],['Eduart','Mele','mësues teorie'],
  ['Saimir','Demo','mësues teorie'],['Marsjana','Meta','mësues praktike'],['Kristaq','Kikli','mësues praktike'],['Liljana','Çyrbja','mësues praktike'],
  ['Dorian','Kamenica','mësues teorik-praktik'],['Ardiana','Merxhani','mësues teorik-praktik'],['Miranda','Vasili','mësues teorie'],
  ['Fatbardha','Ndreu','mësues teorie'],['Dhurata','Skuqi','mësues teorie'],['Lorna','Gjergji','mësues teorie'],['Arjola','Koka','mësues teorik-praktik'],
  ['Petrit','Bardhi','mësues praktike'],['Islam','Jakupi','mësues praktike'],['Kleo','Zeqja','mësues praktike'],
  ...['Aneo Heba','Ilirjan Gaxholli','Dorjan Myftari','Makbule Dervishi','Andi Xhako','Olsi Tarko','Fatos Haxhi','Bujar Osmani','Ramadan Guri',
     'Melsen Lamaj','Artan Oxhaku','Gazmend Toska','Ylli Shkodrani','Armand Boshnjaku','Regi Ilija','Klevijo Keçi','Maldin Zifle','Andi Shera']
     .map(n => [...n.split(' '), 'instruktor'] as [string, string, string]),
  ['Elvira','Rustani','mësues ndihmës'],['Junida','Hajrullaj','mësues ndihmës'],
];
const SUPPORT: [string, string, string][] = [
  ['Xhemaile','Shqopa','punonjëse e shërbimit psiko-social'],['Kostanca','Balliu','punonjëse e shërbimit psiko-social'],
  ['Pranvera','Plaku','kryetare e degës së Financës'],['Raimonda','Kazanxhi','sekretare'],['Besmire','Lika','specialiste finance'],
  ['Anxhela','Drini','specialiste juriste'],['Marjeta','Mehmeti','magazinière'],
];

const DEPARTMENTS = [
  ['SMT', 'Departamenti i Shërbime Mjetesh Transporti', 'Transport Vehicle Services Department', 'department', '?page_id=18'],
  ['ELE', 'Departamenti i Elektroteknikës', 'Electrical Engineering Department', 'department', '?page_id=16'],
  ['TIK', 'Departamenti i Informatikës', 'ICT Department', 'department', '?page_id=20'],
  ['MTH', 'Departamenti i Mekanikës & Termohidraulikës', 'Mechanics & Thermo-hydraulics Department', 'department', '?page_id=26'],
  ['SHS', 'Ekipi Lëndor i Shkencave Shoqërore', 'Social Sciences Subject Team', 'subject_team', '?page_id=24'],
  ['SHN', 'Ekipi Lëndor i Shkencave Natyrore', 'Natural Sciences Subject Team', 'subject_team', '?page_id=22'],
] as const;

const PROGRAMS = [
  ['SMT', 'Shërbime mjetesh transporti', 'Transport vehicle services', 'SMT', '?page_id=480'],
  ['MEK', 'Mekanikë', 'Mechanics', 'MTH', '?page_id=782'],
  ['ELE', 'Elektroteknikë & Elektronikë e Integruar', 'Electrical Engineering & Integrated Electronics', 'ELE', '?page_id=481'],
  ['ITH', 'Instalues i Sistemeve Termohidraulike', 'Thermo-hydraulic Systems Installer', 'MTH', '?page_id=486'],
  ['TIK', 'Teknologji Informacioni dhe Komunikimi', 'Information & Communication Technology', 'TIK', '?page_id=485'],
] as const;

const CATEGORIES = [
  ['about', 'Rreth shkollës', 'About the school'], ['regulations', 'Rregullore', 'Regulations'], ['programs', 'Drejtime & lëndë', 'Programs & courses'],
  ['calendar', 'Kalendar akademik', 'Academic calendar'], ['exams', 'Provime & Matura', 'Exams & Matura'], ['guides', 'Udhëzues për nxënësit', 'Student guides'],
  ['departments', 'Departamente', 'Departments'], ['procedures', 'Procedura administrative', 'Administrative procedures'], ['staff', 'Stafi', 'Staff'],
  ['course', 'Materiale lënde', 'Course materials'],
] as const;

async function main() {
  const year = '2026-2027';
  const hash = (p: string) => bcrypt.hash(p, 12);
  const NO_LOGIN = '!';                       // bcrypt never matches → directory-only accounts

  for (const [i, [slug, sq, en]] of CATEGORIES.entries())
    await query('INSERT INTO document_categories(id,slug,name_sq,name_en) VALUES ($1,$2,$3,$4)', [i + 1, slug, sq, en]);

  const dep: Record<string, number> = {};
  for (const [code, sq, en, kind, url] of DEPARTMENTS)
    dep[code] = (await query('INSERT INTO departments(code,name_sq,name_en,kind,source_url) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [code, sq, en, kind, SRC + '/' + url])).rows[0].id;

  const prog: Record<string, number> = {};
  for (const [code, sq, en, d, url] of PROGRAMS)
    prog[code] = (await query('INSERT INTO programs(code,name_sq,name_en,department_id,source_url) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [code, sq, en, dep[d], SRC + '/' + url])).rows[0].id;

  // Real staff → directory-only users (cannot log in; placeholder emails on reserved .invalid TLD)
  let n = 0;
  const insertStaff = async (list: [string, string, string][], teacher: boolean) => {
    for (const [fn, ln, pos] of list) {
      const id = (await query(`INSERT INTO users(email,password_hash,first_name,last_name,role_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [`staff${++n}@beqircela.invalid`, NO_LOGIN, fn, ln, teacher ? 2 : 3])).rows[0].id;
      if (teacher) await query('INSERT INTO teachers(user_id, position) VALUES ($1,$2)', [id, pos]);
      else await query('UPDATE users SET is_active=false WHERE id=$1', [id]);   // support staff: not admins of the app
    }
  };
  await insertStaff(STAFF, true);
  await insertStaff(SUPPORT, false);

  // ── DEMO accounts ──
  const mk = async (email: string, pw: string, fn: string, ln: string, role: number) =>
    (await query(`INSERT INTO users(email,password_hash,first_name,last_name,role_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [email, await hash(pw), fn, ln, role])).rows[0].id as string;
  const admin = await mk('admin@uniassist.demo', 'Admin2026!', 'Administrator', 'Demo', 3);
  const t1 = await mk('mesues.tik@uniassist.demo', 'Mesues2026!', 'Mësues', 'TIK (demo)', 2);
  const t2 = await mk('mesues.ele@uniassist.demo', 'Mesues2026!', 'Mësuese', 'Elektro (demo)', 2);
  await query(`INSERT INTO teachers(user_id, position, department_id, office) VALUES ($1,'mësues teorie',$2,'Lab TIK 1'),($3,'mësues praktike',$4,'Lab Elektro')`,
    [t1, dep.TIK, t2, dep.ELE]);

  // ── DEMO class groups, courses, timetable, exams ──
  const cg: Record<string, number> = {};
  for (const [name, p, g] of [['TIK 11-A', 'TIK', 11], ['TIK 12-A', 'TIK', 12], ['ELE 11-A', 'ELE', 11], ['SMT 10-A', 'SMT', 10], ['MEK 12-B', 'MEK', 12]] as const)
    cg[name] = (await query('INSERT INTO class_groups(name,program_id,grade,school_year) VALUES ($1,$2,$3,$4) RETURNING id', [name, prog[p], g, year])).rows[0].id;

  const COURSES = [
    ['TIK-PRG', 'Programim (Python)', 'Programming (Python)', 'theory', 4, 'TIK', 'TIK', 'Bazat e programimit, algoritmet dhe strukturat e të dhënave.', 'Programming fundamentals, algorithms and data structures.'],
    ['TIK-RRJ', 'Rrjeta kompjuterike', 'Computer networks', 'theory', 3, 'TIK', 'TIK', 'Modeli OSI, adresimi IP, konfigurimi i rrjeteve lokale.', 'OSI model, IP addressing, LAN configuration.'],
    ['TIK-PRA', 'Praktikë TIK', 'ICT practice', 'practice', 6, 'TIK', 'TIK', 'Montim dhe mirëmbajtje kompjuterash, laborator.', 'Computer assembly and maintenance, lab work.'],
    ['ELE-ELB', 'Elektroteknikë bazë', 'Basic electrical engineering', 'theory', 4, 'ELE', 'ELE', 'Qarqet elektrike, ligjet e Ohmit dhe Kirchhoff-it.', 'Electric circuits, Ohm and Kirchhoff laws.'],
    ['ELE-INS', 'Instalime elektrike', 'Electrical installations', 'practice', 6, 'ELE', 'ELE', 'Instalime civile dhe siguria në punë.', 'Residential installations and workplace safety.'],
    ['GEN-MAT', 'Matematikë', 'Mathematics', 'general', 3, null, 'SHN', 'Lëndë e kulturës së përgjithshme.', 'General education subject.'],
    ['GEN-GJS', 'Gjuhë shqipe dhe letërsi', 'Albanian language & literature', 'general', 3, null, 'SHS', 'Lëndë e kulturës së përgjithshme.', 'General education subject.'],
    ['GEN-ANG', 'Gjuhë angleze', 'English language', 'general', 2, null, 'SHS', 'Lëndë e kulturës së përgjithshme.', 'General education subject.'],
  ] as const;
  const c: Record<string, number> = {};
  for (const [code, sq, en, kind, h, p, d, dsq, den] of COURSES)
    c[code] = (await query(`INSERT INTO courses(code,name_sq,name_en,kind,weekly_hours,program_id,department_id,description_sq,description_en)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [code, sq, en, kind, h, p ? prog[p] : null, dep[d], dsq, den])).rows[0].id;

  for (const code of ['TIK-PRG', 'TIK-RRJ', 'TIK-PRA', 'GEN-MAT']) await query('INSERT INTO course_teachers VALUES ($1,$2)', [c[code], t1]);
  for (const code of ['ELE-ELB', 'ELE-INS']) await query('INSERT INTO course_teachers VALUES ($1,$2)', [c[code], t2]);

  const enroll: Record<string, string[]> = {
    'TIK 11-A': ['TIK-PRG', 'TIK-RRJ', 'TIK-PRA', 'GEN-MAT', 'GEN-GJS', 'GEN-ANG'], 'TIK 12-A': ['TIK-PRG', 'TIK-RRJ', 'TIK-PRA', 'GEN-MAT', 'GEN-ANG'],
    'ELE 11-A': ['ELE-ELB', 'ELE-INS', 'GEN-MAT', 'GEN-GJS', 'GEN-ANG'], 'SMT 10-A': ['GEN-MAT', 'GEN-GJS', 'GEN-ANG'], 'MEK 12-B': ['GEN-MAT', 'GEN-ANG'],
  };
  for (const [g, list] of Object.entries(enroll)) for (const code of list) await query('INSERT INTO enrollments VALUES ($1,$2)', [c[code], cg[g]]);

  // Timetable: periods 07:50–14:10 (45 min + breaks) — demo only
  const periods = [['07:50', '08:35'], ['08:40', '09:25'], ['09:40', '10:25'], ['10:30', '11:15'], ['11:20', '12:05'], ['12:15', '13:00'], ['13:05', '13:50']];
  const teacherOf = (code: string) => (code.startsWith('TIK') || code === 'GEN-MAT' ? t1 : code.startsWith('ELE') ? t2 : null);
  for (const [g, list] of Object.entries(enroll)) {
    let slot = Object.keys(enroll).indexOf(g);          // offset per class so teachers don't overlap much
    for (const code of list) {
      const hours = COURSES.find(x => x[0] === code)![4];
      for (let h = 0; h < Math.min(hours, 4); h++, slot++) {
        const day = (slot % 5) + 1, p = periods[Math.floor(slot / 5) % periods.length];
        await query(`INSERT INTO schedules(course_id,class_group_id,teacher_id,weekday,start_time,end_time,room) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [c[code], cg[g], teacherOf(code), day, p[0], p[1], code.endsWith('PRA') || code === 'ELE-INS' ? 'Reparti i praktikës' : `Klasa ${100 + (slot % 20)}`]);
      }
    }
  }

  const d = (days: number, hour = 9) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(hour, 0, 0, 0); return x; };
  const EXAMS = [
    ['Test periudhe — Programim', 'term', 'TIK-PRG', 'TIK 11-A', d(9), 'Lab TIK 1'],
    ['Test periudhe — Rrjeta', 'term', 'TIK-RRJ', 'TIK 12-A', d(12), 'Lab TIK 2'],
    ['Provim praktik — Instalime elektrike', 'practicum', 'ELE-INS', 'ELE 11-A', d(16, 8), 'Reparti i praktikës'],
    ['Test periudhe — Matematikë', 'term', 'GEN-MAT', 'TIK 11-A', d(20), 'Klasa 104'],
    ['Provim niveli (demo)', 'level', null, null, d(40), null],
  ] as const;
  for (const [title, kind, course, group, at, room] of EXAMS)
    await query(`INSERT INTO exams(title,kind,course_id,class_group_id,starts_at,room,notes,is_demo) VALUES ($1,$2,$3,$4,$5,$6,'Të dhëna demo — jo zyrtare',true)`,
      [title, kind, course ? c[course] : null, group ? cg[group] : null, at, room]);

  // Demo students
  const students: [string, string, string][] = [['Arta', 'Hoxha', 'TIK 11-A'], ['Klajdi', 'Mema', 'TIK 11-A'], ['Sara', 'Leka', 'TIK 12-A'], ['Endri', 'Prifti', 'ELE 11-A'], ['Megi', 'Duka', 'SMT 10-A']];
  const studentIds: string[] = [];
  for (const [i, [fn, ln, g]] of students.entries()) {
    const id = await mk(i === 0 ? 'nxenes@uniassist.demo' : `nxenes${i + 1}@uniassist.demo`, 'Nxenes2026!', fn, ln, 1);
    await query(`INSERT INTO students(user_id, student_number, class_group_id, enrolled_year) VALUES ($1,$2,$3,$4)`, [id, `BC26${String(1001 + i)}`, cg[g], 2026 - (Number(g.match(/\d+/)![0]) - 10)]);
    studentIds.push(id);
  }

  await query(`INSERT INTO announcements(author_id, course_id, title, body) VALUES
    ($1, NULL, 'Mirë se vini në UniAssist', 'Asistenti përgjigjet vetëm nga dokumentet zyrtare të shkollës dhe tregon burimin e çdo përgjigjeje. Orari dhe provimet në këtë version janë të dhëna demo.'),
    ($2, $3, 'Material i ri për Programim', 'Detyra e javës është publikuar në seksionin Dokumente.')`, [admin, t1, c['TIK-PRG']]);
  for (const sid of studentIds) await query(`INSERT INTO notifications(user_id,title,body,link) VALUES ($1,'Mirë se vini!','Provoni asistentin AI për pyetje rreth shkollës.','/chat')`, [sid]);

  // ── Knowledge base: real public content only ──
  const uploadDir = path.resolve(config.UPLOAD_DIR); await mkdir(uploadDir, { recursive: true });
  const kbDir = path.join(here, 'kb');
  const staffDoc = path.join(kbDir, '04-stafi.md');
  await writeFile(staffDoc, `Stafi mësimor dhe mbështetës i shkollës "Beqir Çela", viti shkollor 2024–2025\nBurimi: ${SRC}/?page_id=171\n\nSTAFI MËSIMOR\n` +
    STAFF.map(([f, l, p], i) => `${i + 1}. ${f} ${l} — ${p}`).join('\n') +
    '\n\nSTAFI MBËSHTETËS (zgjedhje)\n' + SUPPORT.map(([f, l, p], i) => `${i + 1}. ${f} ${l} — ${p}`).join('\n') + '\n');

  const KB: Record<string, [string, string, string]> = {
    '01-historiku.md': ['Historiku i shkollës "Beqir Çela"', 'about', `${SRC}/?page_id=169`],
    '02-kontakt-drejtimi.md': ['Kontakti, orari dhe ekipi drejtues', 'about', `${SRC}/`],
    '03-drejtimet-departamentet.md': ['Drejtimet, departamentet dhe Matura', 'departments', `${SRC}/?page_id=183`],
    '04-stafi.md': ['Stafi pedagogjik 2024–2025', 'staff', `${SRC}/?page_id=171`],
  };
  for (const f of await readdir(kbDir)) {
    const meta = KB[f]; if (!meta) continue;
    const dest = randomUUID() + '.md';
    await copyFile(path.join(kbDir, f), path.join(uploadDir, dest));
    const size = (await stat(path.join(uploadDir, dest))).size;
    const catId = CATEGORIES.findIndex(x => x[0] === meta[1]) + 1;
    const id = (await query(`INSERT INTO documents(title,category_id,visibility,file_path,original_name,mime_type,size_bytes,source_url,uploaded_by)
                             VALUES ($1,$2,'public',$3,$4,'text/markdown',$5,$6,$7) RETURNING id`, [meta[0], catId, dest, f, size, meta[2], admin])).rows[0].id;
    const chunks = await ingestDocument(id, path.join(uploadDir, dest), 'text/markdown');
    console.log(`  KB: ${meta[0]} → ${chunks} chunks`);
  }

  console.log(`\nSeed complete.\n  admin@uniassist.demo / Admin2026!\n  mesues.tik@uniassist.demo / Mesues2026!\n  nxenes@uniassist.demo / Nxenes2026!`);
  await pool.end();
}

main().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
