'use strict';
require('dotenv').config();
if (!process.env.CHAT_ENCRYPTION_KEY) {
  process.env.CHAT_ENCRYPTION_KEY = 'seed_dummy_key_not_used_for_real_encryption_just_bootstrap';
}
const mongoose = require('mongoose');
const User     = require('./models/User');
const Subject  = require('./models/Subject');
const MenuItem = require('./models/MenuItem');
const Table    = require('./models/Table');
const ChatRoom = require('./models/ChatRoom');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_db';

const DEPARTMENTS = ['Computer Science', 'Electrical & Electronics', 'Mechanical'];
const DEPT_CODES  = { 'Computer Science': 'CS', 'Electrical & Electronics': 'EEE', 'Mechanical': 'MECH' };

const SUBJECTS = {
  'Computer Science': [
    { code:'CS101', name:'Engineering Mathematics I',       semester:'1' },
    { code:'CS102', name:'Programming Fundamentals',        semester:'1' },
    { code:'CS103', name:'Digital Logic Design',            semester:'1' },
    { code:'CS201', name:'Engineering Mathematics II',      semester:'2' },
    { code:'CS202', name:'Data Structures',                 semester:'2' },
    { code:'CS203', name:'Computer Organisation',           semester:'2' },
    { code:'CS301', name:'Object Oriented Programming',     semester:'3' },
    { code:'CS302', name:'Database Management Systems',     semester:'3' },
    { code:'CS303', name:'Operating Systems',               semester:'3' },
    { code:'CS401', name:'Computer Networks',               semester:'4' },
    { code:'CS402', name:'Software Engineering',            semester:'4' },
    { code:'CS403', name:'Theory of Computation',           semester:'4' },
    { code:'CS501', name:'Artificial Intelligence',         semester:'5' },
    { code:'CS502', name:'Web Technologies',                semester:'5' },
    { code:'CS503', name:'Compiler Design',                 semester:'5' },
    { code:'CS601', name:'Advance Computer Network',        semester:'6' },
    { code:'CS602', name:'Indian Constitution',             semester:'6' },
    { code:'CS603', name:'Software Testing',                semester:'6' },
    { code:'CS604', name:'Cyber Security Laws',             semester:'6' },
    { code:'CS605', name:'Entrepreneurship and Start-ups',  semester:'6' },
    { code:'CS606', name:'Seminar',                         semester:'6' },
    { code:'CS607', name:'Major Project',                   semester:'6' },
  ],
  'Electrical & Electronics': [
    { code:'EEE101', name:'Engineering Mathematics I',          semester:'1' },
    { code:'EEE102', name:'Basic Electrical Engineering',       semester:'1' },
    { code:'EEE103', name:'Electronic Devices & Circuits',      semester:'1' },
    { code:'EEE201', name:'Engineering Mathematics II',         semester:'2' },
    { code:'EEE202', name:'Network Analysis',                   semester:'2' },
    { code:'EEE203', name:'Electromagnetic Theory',             semester:'2' },
    { code:'EEE301', name:'Signals & Systems',                  semester:'3' },
    { code:'EEE302', name:'Digital Electronics',                semester:'3' },
    { code:'EEE303', name:'Electrical Machines I',              semester:'3' },
    { code:'EEE401', name:'Control Systems',                    semester:'4' },
    { code:'EEE402', name:'Electrical Machines II',             semester:'4' },
    { code:'EEE403', name:'Power Electronics',                  semester:'4' },
    { code:'EEE501', name:'Power Systems I',                    semester:'5' },
    { code:'EEE502', name:'Microprocessors & Microcontrollers', semester:'5' },
    { code:'EEE503', name:'Measurement & Instrumentation',      semester:'5' },
    { code:'EEE601', name:'Power Systems II',                   semester:'6' },
    { code:'EEE602', name:'Renewable Energy Systems',           semester:'6' },
    { code:'EEE603', name:'Project Work',                       semester:'6' },
  ],
  'Mechanical': [
    { code:'ME101', name:'Engineering Mathematics I',        semester:'1' },
    { code:'ME102', name:'Engineering Drawing',              semester:'1' },
    { code:'ME103', name:'Engineering Physics',              semester:'1' },
    { code:'ME201', name:'Engineering Mathematics II',       semester:'2' },
    { code:'ME202', name:'Mechanics of Solids',              semester:'2' },
    { code:'ME203', name:'Thermodynamics',                   semester:'2' },
    { code:'ME301', name:'Fluid Mechanics',                  semester:'3' },
    { code:'ME302', name:'Manufacturing Processes I',        semester:'3' },
    { code:'ME303', name:'Kinematics of Machines',           semester:'3' },
    { code:'ME401', name:'Heat Transfer',                    semester:'4' },
    { code:'ME402', name:'Manufacturing Processes II',       semester:'4' },
    { code:'ME403', name:'Dynamics of Machines',             semester:'4' },
    { code:'ME501', name:'Machine Design I',                 semester:'5' },
    { code:'ME502', name:'Industrial Engineering',           semester:'5' },
    { code:'ME503', name:'Refrigeration & Air Conditioning', semester:'5' },
    { code:'ME601', name:'Machine Design II',                semester:'6' },
    { code:'ME602', name:'Automobile Engineering',           semester:'6' },
    { code:'ME603', name:'Project Work',                     semester:'6' },
  ],
};

const FACULTY = [
  // Computer Science — 7 faculty
  { name:'Dr. Irfan Khan',          email:'dr.irfan@aju.edu',     password:'Irfan@1234',   role:'faculty', department:'Computer Science' },
  { name:'Prof. Megha Sinha',       email:'prof.megha@aju.edu',   password:'Megha@1234',   role:'faculty', department:'Computer Science' },
  { name:'Prof. Nikita Kumari',     email:'prof.nikita@aju.edu',  password:'Nikita@1234',  role:'faculty', department:'Computer Science' },
  { name:'Prof. Ajay Bara',         email:'prof.ajay@aju.edu',    password:'Ajay@1234',    role:'faculty', department:'Computer Science' },
  { name:'Prof. Anubhav Shreshtha', email:'prof.anubhav@aju.edu', password:'Anubhav@1234', role:'faculty', department:'Computer Science' },
  { name:'Prof. Tanya Ghosh',       email:'prof.tanya@aju.edu',   password:'Tanya@1234',   role:'faculty', department:'Computer Science' },
  { name:'Prof. Soumya Shree',      email:'prof.soumya@aju.edu',  password:'Soumya@1234',  role:'faculty', department:'Computer Science' },
  // Electrical & Electronics — 4 faculty
  { name:'Dr. Ravi Shankar',        email:'dr.ravi@aju.edu',      password:'Ravi@12345',   role:'faculty', department:'Electrical & Electronics' },
  { name:'Prof. Anita Roy',         email:'prof.anita@aju.edu',   password:'Anita@1234',   role:'faculty', department:'Electrical & Electronics' },
  { name:'Dr. Sunil Varma',         email:'dr.sunil@aju.edu',     password:'Sunil@1234',   role:'faculty', department:'Electrical & Electronics' },
  { name:'Prof. Rekha Das',         email:'prof.rekha@aju.edu',   password:'Rekha@1234',   role:'faculty', department:'Electrical & Electronics' },
  // Mechanical — 4 faculty
  { name:'Dr. Suresh Patil',        email:'dr.suresh@aju.edu',    password:'Suresh@1234',  role:'faculty', department:'Mechanical' },
  { name:'Prof. Kavita Nair',       email:'prof.kavita@aju.edu',  password:'Kavita@1234',  role:'faculty', department:'Mechanical' },
  { name:'Dr. Ramesh Yadav',        email:'dr.ramesh@aju.edu',    password:'Ramesh@1234',  role:'faculty', department:'Mechanical' },
  { name:'Prof. Sunita Joshi',      email:'prof.sunita@aju.edu',  password:'Sunita@1234',  role:'faculty', department:'Mechanical' },
];

// ── Team members as CS Sem-5 students ────────────────────────────────────────
const TEAM_MEMBERS = [
  { name:'Aayush Jha',     email:'aayush@aju.edu',  password:'Aayush@1234', role:'student', department:'Computer Science', semester:'6', studentId:'CS2024T01' },
  { name:'Zaid Khan',      email:'zaid@aju.edu',    password:'Zaid@1234',   role:'student', department:'Computer Science', semester:'6', studentId:'CS2024T02' },
  { name:'Himadri Sekhar', email:'himadri@aju.edu', password:'Himadri@123', role:'student', department:'Computer Science', semester:'6', studentId:'CS2024T03' },
  { name:'Noor Alam',      email:'noor@aju.edu',    password:'Noor@1234',   role:'student', department:'Computer Science', semester:'6', studentId:'CS2024T04' },
];

function generateStudents(dept, count = 30) {
  const code = DEPT_CODES[dept];
  const firstNames = ['Aarav','Bhavna','Chirag','Deepa','Eshan','Farida','Gaurav','Hema','Imran','Jyoti',
                      'Karan','Lalita','Mohit','Neha','Om','Pooja','Qasim','Riya','Sanjay','Tara',
                      'Uday','Vandana','Wasim','Aryan','Yash','Zara','Aditya','Bindu','Chandan','Divya'];
  const lastNames  = ['Kumar','Singh','Sharma','Patel','Gupta','Mehta','Joshi','Das','Nair','Trivedi',
                      'Yadav','Verma','Reddy','Rao','Pillai','Bose','Iyer','Menon','Shah','Desai',
                      'Tiwari','Mishra','Pandey','Chauhan','Srivastava','Bajaj','Chopra','Malhotra','Kapoor','Dubey'];
  const students = [];
  for (let i = 0; i < count; i++) {
    const fn  = firstNames[i % firstNames.length];
    const ln  = lastNames[i % lastNames.length];
    const sem = String(Math.min(6, Math.ceil((i + 1) / (count / 6))));
    students.push({
      name:       `${fn} ${ln}`,
      email:      `${fn.toLowerCase()}.${ln.toLowerCase()}.${code.toLowerCase()}${i + 1}@aju.edu`,
      password:   `${fn}@123456`,
      role:       'student',
      department: dept,
      semester:   sem,
      studentId:  `${code}2024${String(i + 1).padStart(3, '0')}`,
    });
  }
  return students;
}

const MENU = [
  // Breakfast
  { name:'Masala Dosa',          category:'breakfast', price:60,  isVegetarian:true,  description:'Crispy dosa with spiced potato filling',       preparationTime:10 },
  { name:'Poha',                 category:'breakfast', price:35,  isVegetarian:true,  description:'Flattened rice with mustard and veggies',      preparationTime:8  },
  { name:'Bread Omelette',       category:'breakfast', price:45,  isVegetarian:false, description:'Egg omelette with toasted bread',              preparationTime:7  },
  { name:'Idli Sambar (4 pcs)',  category:'breakfast', price:40,  isVegetarian:true,  description:'Steamed rice cakes with lentil soup',          preparationTime:8  },
  { name:'Aloo Paratha',         category:'breakfast', price:50,  isVegetarian:true,  description:'Stuffed whole wheat flatbread with butter',    preparationTime:10 },
  { name:'Upma',                 category:'breakfast', price:30,  isVegetarian:true,  description:'Semolina porridge with vegetables',            preparationTime:8  },
  { name:'Boiled Eggs (2)',      category:'breakfast', price:25,  isVegetarian:false, description:'Hard boiled eggs with salt & pepper',          preparationTime:5  },
  // Lunch
  { name:'Veg Thali',            category:'lunch',     price:90,  isVegetarian:true,  description:'Dal, 2 sabzi, rice, roti, salad',             preparationTime:15 },
  { name:'Chicken Biryani',      category:'lunch',     price:130, isVegetarian:false, description:'Aromatic basmati rice with spiced chicken',    preparationTime:20 },
  { name:'Paneer Butter Masala', category:'lunch',     price:110, isVegetarian:true,  description:'Creamy paneer curry with 3 rotis',             preparationTime:15 },
  { name:'Rajma Chawal',         category:'lunch',     price:80,  isVegetarian:true,  description:'Kidney bean curry with steamed rice',          preparationTime:10 },
  { name:'Egg Curry + Rice',     category:'lunch',     price:95,  isVegetarian:false, description:'Spiced egg curry with steamed rice',           preparationTime:12 },
  { name:'Chole Bhature',        category:'lunch',     price:75,  isVegetarian:true,  description:'Spiced chickpeas with fried bread',            preparationTime:12 },
  { name:'Mutton Curry + Roti',  category:'lunch',     price:160, isVegetarian:false, description:'Slow-cooked mutton curry with 3 rotis',        preparationTime:25 },
  // Dinner
  { name:'Dal Makhani + Naan',   category:'dinner',    price:100, isVegetarian:true,  description:'Rich black lentil curry with naan',            preparationTime:15 },
  { name:'Egg Fried Rice',       category:'dinner',    price:85,  isVegetarian:false, description:'Wok-tossed rice with eggs and vegetables',     preparationTime:12 },
  { name:'Veg Pulao',            category:'dinner',    price:75,  isVegetarian:true,  description:'Basmati rice with mixed vegetables',           preparationTime:15 },
  { name:'Chapati + Sabzi',      category:'dinner',    price:60,  isVegetarian:true,  description:'4 chapatis with seasonal vegetable curry',     preparationTime:10 },
  // Snacks
  { name:'Samosa (2 pcs)',       category:'snacks',    price:20,  isVegetarian:true,  description:'Crispy pastry with spiced potato filling',     preparationTime:5  },
  { name:'Vada Pav',             category:'snacks',    price:25,  isVegetarian:true,  description:'Mumbai-style potato fritter in a bun',         preparationTime:5  },
  { name:'Maggi Noodles',        category:'snacks',    price:40,  isVegetarian:true,  description:'2-minute noodles with veggies',                preparationTime:8  },
  { name:'Bread Pakora (2 pcs)', category:'snacks',    price:30,  isVegetarian:true,  description:'Gram-flour battered bread fritters',           preparationTime:7  },
  { name:'Pani Puri (6 pcs)',    category:'snacks',    price:35,  isVegetarian:true,  description:'Crispy shells with tangy tamarind water',      preparationTime:5  },
  // Beverages
  { name:'Masala Chai',          category:'beverages', price:15,  isVegetarian:true,  description:'Spiced Indian milk tea',                       preparationTime:5  },
  { name:'Cold Coffee',          category:'beverages', price:55,  isVegetarian:true,  description:'Chilled blended coffee with milk',             preparationTime:5  },
  { name:'Lassi (Sweet)',        category:'beverages', price:40,  isVegetarian:true,  description:'Chilled yogurt-based drink',                   preparationTime:4  },
  { name:'Fresh Lime Soda',      category:'beverages', price:30,  isVegetarian:true,  description:'Lime juice with soda and salt/sugar',          preparationTime:3  },
  { name:'Mango Shake',          category:'beverages', price:60,  isVegetarian:true,  description:'Fresh mango blended with milk',                preparationTime:5  },
  // Desserts
  { name:'Gulab Jamun (2 pcs)',  category:'desserts',  price:30,  isVegetarian:true,  description:'Soft milk dumplings in sugar syrup',           preparationTime:3  },
  { name:'Kheer',                category:'desserts',  price:40,  isVegetarian:true,  description:'Creamy rice pudding with cardamom',            preparationTime:5  },
  { name:'Rasgulla (2 pcs)',     category:'desserts',  price:35,  isVegetarian:true,  description:'Spongy cottage cheese balls in syrup',         preparationTime:3  },
  // Specials
  { name:'Friday Special Thali', category:'specials',  price:120, isVegetarian:true,  description:'Special Friday vegetarian thali with 4 items', preparationTime:20 },
  { name:'Chicken Burger',       category:'specials',  price:110, isVegetarian:false, description:'Grilled chicken patty with coleslaw & fries',  preparationTime:15 },
];

const TABLES = [
  { tableNumber:'T-01', section:'indoor',    capacity:4,  floor:1, description:'Indoor 4-seater',   amenities:['ac'] },
  { tableNumber:'T-02', section:'indoor',    capacity:6,  floor:1, description:'Window-facing',      amenities:['ac','window_view'] },
  { tableNumber:'O-01', section:'outdoor',   capacity:4,  floor:1, description:'Garden 4-seater',   amenities:[] },
  { tableNumber:'R-01', section:'rooftop',   capacity:4,  floor:3, description:'Rooftop view',       amenities:['window_view'] },
  { tableNumber:'P-01', section:'private',   capacity:8,  floor:2, description:'Private room A',     amenities:['ac','projector','whiteboard'] },
  { tableNumber:'P-02', section:'private',   capacity:12, floor:2, description:'Conference room B',  amenities:['ac','projector','whiteboard'] },
  { tableNumber:'C-01', section:'cafeteria', capacity:4,  floor:1, description:'Cafeteria table',    amenities:[] },
  { tableNumber:'C-02', section:'cafeteria', capacity:6,  floor:1, description:'Cafeteria large',    amenities:[] },
];

async function seed() {
  console.log('\n🌱  AJUQNET v10 — Seed Script\n════════════════════════════');
  await mongoose.connect(MONGO_URI);
  console.log('✅  MongoDB connected');

  await Promise.all([User.deleteMany({}), Subject.deleteMany({}), MenuItem.deleteMany({}), Table.deleteMany({}), ChatRoom.deleteMany({})]);
  console.log('🗑   Cleared existing data');

  // ── Admin & canteen ───────────────────────────────────────────────────────
  const admin = await User.create({ name:'Ashwini Kumar', email:'ashwini@aju.edu', password:'Ashwini@123', role:'admin', department:'Administration' });
  await User.create({ name:'Canteen Staff', email:'canteen@aju.edu', password:'Canteen@123', role:'canteen', department:'Canteen Services' });

  // ── Faculty ───────────────────────────────────────────────────────────────
  const facultyDocs = await User.create(FACULTY);
  console.log(`👤  Created admin + canteen + ${facultyDocs.length} faculty`);

  // ── Team members as CS Sem-5 students ────────────────────────────────────
  const teamDocs = await User.create(TEAM_MEMBERS);
  console.log(`🧑‍💻  Team members added: ${teamDocs.map(t => t.name).join(', ')}`);

  // ── Regular students ──────────────────────────────────────────────────────
  const allStudents = [...teamDocs];
  for (const dept of DEPARTMENTS) {
    const students = await User.create(generateStudents(dept, 30));
    allStudents.push(...students);
    console.log(`🎓  30 students → ${dept}`);
  }

  // ── Subjects ──────────────────────────────────────────────────────────────
  const allSubjectData = [];
  for (const dept of DEPARTMENTS) {
    SUBJECTS[dept].forEach(s => allSubjectData.push({ ...s, department: dept }));
  }
  const subjectDocs = await Subject.create(allSubjectData);
  console.log(`📚  Created ${subjectDocs.length} subjects`);

  // ── Assign faculty to subjects ────────────────────────────────────────────
  const byDept = {};
  facultyDocs.forEach(f => {
    if (!byDept[f.department]) byDept[f.department] = [];
    byDept[f.department].push(f);
  });

  for (const [dept, fList] of Object.entries(byDept)) {
    let semSplits;
    if (dept === 'Computer Science') {
      semSplits = [['1'],['2'],['3'],['4'],['5'],['6'],['6']];
    } else {
      semSplits = [['1'],['2'],['3','4'],['5','6']];
    }
    for (let i = 0; i < fList.length; i++) {
      const fac  = fList[i];
      const sems = semSplits[i] || ['1'];
      let ids;
      if (dept === 'Computer Science' && i === 6) {
        ids = subjectDocs.filter(s => s.department === dept && s.semester === '6').slice(3).map(s => s._id);
      } else if (dept === 'Computer Science' && i === 5) {
        ids = subjectDocs.filter(s => s.department === dept && s.semester === '6').slice(0, 3).map(s => s._id);
      } else {
        ids = subjectDocs.filter(s => s.department === dept && sems.includes(s.semester)).map(s => s._id);
      }
      await Subject.updateMany({ _id: { $in: ids } }, { $set: { assignedFaculty: fac._id, assignedFacultyName: fac.name } });
      console.log(`  ↳ ${fac.name}: sem ${sems.join(',')} (${dept})`);
    }
  }

  // ── Menu & Tables ─────────────────────────────────────────────────────────
  await MenuItem.create(MENU.map(m => ({ ...m, createdBy: admin._id })));
  await Table.create(TABLES.map(t => ({ ...t, createdBy: admin._id })));
  console.log('🍽   Menu & tables created');

  // ── Chat rooms ────────────────────────────────────────────────────────────
  const allUsers = await User.find({});
  const memberObj = (u, isAdmin = false) => ({ user: u._id, role: u.role, isAdmin });
  const byDeptStudents = {};
  DEPARTMENTS.forEach(d => { byDeptStudents[d] = allStudents.filter(s => s.department === d); });

  await ChatRoom.create([
    { name:'General', slug:'general', description:'Open to everyone', type:'public', allowedRoles:['admin','faculty','student','canteen'], createdBy:admin._id, members:allUsers.map(u => memberObj(u, u.role === 'admin')) },
    { name:'CS Department', slug:'cs-department', description:'Computer Science', type:'public', allowedRoles:['admin','faculty','student'], createdBy:admin._id, members:[memberObj(admin,true), ...facultyDocs.filter(f=>f.department==='Computer Science').map(f=>memberObj(f)), ...byDeptStudents['Computer Science'].map(s=>memberObj(s))] },
    { name:'EEE Department', slug:'eee-department', description:'Electrical & Electronics', type:'public', allowedRoles:['admin','faculty','student'], createdBy:admin._id, members:[memberObj(admin,true), ...facultyDocs.filter(f=>f.department==='Electrical & Electronics').map(f=>memberObj(f)), ...byDeptStudents['Electrical & Electronics'].map(s=>memberObj(s))] },
    { name:'Mech Department', slug:'mech-department', description:'Mechanical Engineering', type:'public', allowedRoles:['admin','faculty','student'], createdBy:admin._id, members:[memberObj(admin,true), ...facultyDocs.filter(f=>f.department==='Mechanical').map(f=>memberObj(f)), ...byDeptStudents['Mechanical'].map(s=>memberObj(s))] },
    { name:'Faculty Lounge', slug:'faculty-lounge', description:'Faculty & admin only', type:'private', allowedRoles:['admin','faculty'], createdBy:admin._id, members:[memberObj(admin,true), ...facultyDocs.map(f=>memberObj(f))] },
    { name:'Admin HQ', slug:'admin-hq', description:'Administrators only', type:'private', allowedRoles:['admin'], createdBy:admin._id, members:[memberObj(admin,true)] },
    { name:'Canteen Updates', slug:'canteen-updates', description:'Menu & canteen news', type:'public', allowedRoles:['admin','faculty','student'], createdBy:admin._id, members:allUsers.filter(u=>u.role!=='canteen').map(u=>memberObj(u, u.role==='admin')) },
  ]);
  console.log('💬  Created 7 chat rooms');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════');
  console.log('✅  Seed complete!\n');
  console.log('🔑  Login credentials:');
  console.log('─────────────────────────────────────────');
  console.log('ADMIN');
  console.log('  ashwini@aju.edu         / Ashwini@123');
  console.log('\nCANTEEN');
  console.log('  canteen@aju.edu         / Canteen@123');
  console.log('\nTEAM MEMBERS (CS Sem-5 Students)');
  TEAM_MEMBERS.forEach(t => console.log(`  ${t.email.padEnd(25)} / ${t.password}`));
  console.log('\nFACULTY');
  FACULTY.forEach(f => console.log(`  ${f.email.padEnd(25)} / ${f.password}`));
  console.log('─────────────────────────────────────────');
  console.log('\n⚠️  Set CHAT_ENCRYPTION_KEY in .env before starting!\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌  Seed failed:', err.message); process.exit(1); });