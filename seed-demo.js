'use strict';
require('dotenv').config();
if (!process.env.CHAT_ENCRYPTION_KEY) {
  process.env.CHAT_ENCRYPTION_KEY = 'seed_dummy_key_not_used_for_real_encryption_just_bootstrap';
}
const mongoose   = require('mongoose');
const User       = require('./models/User');
const Attendance = require('./models/Attendance');
const Announcement = require('./models/Announcement');
const Subject    = require('./models/Subject');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_db';

// Generate a date N days ago
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function seedDemo() {
  console.log('\n🎭  AJUQNET — Demo Data Seeder\n════════════════════════════');
  await mongoose.connect(MONGO_URI);
  console.log('✅  MongoDB connected');

  // Clear existing demo data
  await Attendance.deleteMany({});
  await Announcement.deleteMany({});
  console.log('🗑   Cleared attendance & announcements');

  // ── Fetch users ───────────────────────────────────────────────────────────
  const admin    = await User.findOne({ role: 'admin' });
  const faculty  = await User.find({ role: 'faculty' });
  const students = await User.find({ role: 'student' });

  if (!admin || faculty.length === 0 || students.length === 0) {
    console.error('❌  No users found. Run npm run seed first!');
    process.exit(1);
  }

  // ── Announcements ─────────────────────────────────────────────────────────
  const announcements = [
    // Admin announcements
    {
      title: 'University Annual Day — 25th March 2025',
      message: 'All students and faculty are invited to the Annual Day celebration on 25th March 2025 at the Main Auditorium. Cultural performances, prize distribution, and dinner will be hosted. Attendance is mandatory for all Sem 5 and Sem 6 students.',
      department: 'all', priority: 'info', pinned: true,
      createdBy: admin._id, createdByName: admin.name, createdByRole: 'admin',
      expiresAt: new Date('2025-03-30'),
    },
    {
      title: 'End Semester Examinations Schedule Released',
      message: 'The End Semester Examination schedule for all departments has been released. Students are advised to check the notice board and download the timetable from the admin portal. Hall tickets will be distributed from 10th March 2025 onwards.',
      department: 'all', priority: 'urgent', pinned: true,
      createdBy: admin._id, createdByName: admin.name, createdByRole: 'admin',
      expiresAt: null,
    },
    {
      title: 'Library Timing Change',
      message: 'Effective from 1st March 2025, the university library will remain open from 8:00 AM to 9:00 PM on weekdays and 9:00 AM to 5:00 PM on Saturdays. The library will remain closed on Sundays and public holidays.',
      department: 'all', priority: 'info', pinned: false,
      createdBy: admin._id, createdByName: admin.name, createdByRole: 'admin',
      expiresAt: null,
    },
    {
      title: 'Sports Week 2025 — Registration Open',
      message: 'Sports Week 2025 will be held from 17th to 22nd March. Events include Cricket, Football, Badminton, Table Tennis, Chess, and Athletics. Students interested in participating must register through the Sports Department by 12th March.',
      department: 'all', priority: 'info', pinned: false,
      createdBy: admin._id, createdByName: admin.name, createdByRole: 'admin',
      expiresAt: new Date('2025-03-22'),
    },
    // CS faculty announcements
    {
      title: 'Web Technologies Lab Assignment — Submission Deadline Extended',
      message: 'The submission deadline for the Web Technologies Lab assignment (Building a REST API) has been extended to 20th March 2025. Students must submit their work via the department portal. Late submissions will not be accepted after the extended deadline.',
      department: 'Computer Science', priority: 'warning', pinned: false,
      createdBy: faculty.find(f => f.department === 'Computer Science')._id,
      createdByName: faculty.find(f => f.department === 'Computer Science').name,
      createdByRole: 'faculty',
      expiresAt: new Date('2025-03-20'),
    },
    {
      title: 'Guest Lecture — Artificial Intelligence in Healthcare',
      message: 'A guest lecture on "Artificial Intelligence in Healthcare" will be conducted by Dr. Rajesh Nair (Senior Data Scientist, Infosys) on 15th March 2025 at 2:00 PM in Seminar Hall A. All CS students are encouraged to attend. Extra credit will be awarded to Sem 5 and Sem 6 students.',
      department: 'Computer Science', priority: 'info', pinned: false,
      createdBy: faculty.find(f => f.department === 'Computer Science')._id,
      createdByName: faculty.find(f => f.department === 'Computer Science').name,
      createdByRole: 'faculty',
      expiresAt: new Date('2025-03-15'),
    },
    {
      title: 'Internal Assessment Results — Sem 5',
      message: 'Internal Assessment results for Sem 5 subjects (AI, Web Technologies, Compiler Design) have been uploaded to the portal. Students with backlogs must meet their respective faculty within 3 working days. Grievances if any must be submitted in writing to the HOD.',
      department: 'Computer Science', priority: 'warning', pinned: false,
      createdBy: faculty.find(f => f.department === 'Computer Science')._id,
      createdByName: faculty.find(f => f.department === 'Computer Science').name,
      createdByRole: 'faculty',
      expiresAt: null,
    },
    // EEE announcements
    {
      title: 'Industrial Visit — NTPC Farakka Power Station',
      message: 'An industrial visit to NTPC Farakka Power Station has been organized for EEE Sem 5 and Sem 6 students on 22nd March 2025. Interested students must submit their consent forms and ₹500 participation fee to the department office by 14th March 2025.',
      department: 'Electrical & Electronics', priority: 'info', pinned: false,
      createdBy: faculty.find(f => f.department === 'Electrical & Electronics')._id,
      createdByName: faculty.find(f => f.department === 'Electrical & Electronics').name,
      createdByRole: 'faculty',
      expiresAt: new Date('2025-03-22'),
    },
    // Mechanical announcements
    {
      title: 'CAD Lab Schedule Update — March 2025',
      message: 'Due to maintenance of CAD workstations, the CAD Lab will be unavailable from 10th to 12th March 2025. All practical sessions scheduled during this period will be rescheduled. Students will be notified of the revised schedule by their respective faculty.',
      department: 'Mechanical', priority: 'warning', pinned: false,
      createdBy: faculty.find(f => f.department === 'Mechanical')._id,
      createdByName: faculty.find(f => f.department === 'Mechanical').name,
      createdByRole: 'faculty',
      expiresAt: null,
    },
    {
      title: 'Project Presentation — Sem 6 Mechanical',
      message: 'Final year project presentations for Sem 6 Mechanical students are scheduled for 28th and 29th March 2025. Each group will get 15 minutes for presentation and 5 minutes for Q&A. Evaluation will be done by internal and external examiners. Report submission is due by 24th March.',
      department: 'Mechanical', priority: 'urgent', pinned: false,
      createdBy: faculty.find(f => f.department === 'Mechanical')._id,
      createdByName: faculty.find(f => f.department === 'Mechanical').name,
      createdByRole: 'faculty',
      expiresAt: null,
    },
  ];

  await Announcement.create(announcements);
  console.log(`📢  Created ${announcements.length} announcements`);

  // ── Attendance ────────────────────────────────────────────────────────────
  // Get subjects per dept
  const subjects = await Subject.find({ isActive: true });
  const depts = ['Computer Science', 'Electrical & Electronics', 'Mechanical'];

  let totalAttendance = 0;
  const attendanceDocs = [];

  for (const dept of depts) {
    const deptFaculty  = faculty.filter(f => f.department === dept);
    const deptStudents = students.filter(s => s.department === dept);
    const deptSubjects = subjects.filter(s => s.department === dept);

    if (deptFaculty.length === 0 || deptSubjects.length === 0) continue;

    // For each subject, generate 20 days of attendance
    for (const subject of deptSubjects) {
      const semNum   = parseInt(subject.semester);
      const semStudents = deptStudents.filter(s => parseInt(s.semester) === semNum);
      if (semStudents.length === 0) continue;

      // Find assigned faculty for this subject
      const fac = subject.assignedFaculty
        ? deptFaculty.find(f => f._id.toString() === subject.assignedFaculty.toString()) || deptFaculty[0]
        : deptFaculty[0];

      // Generate 20 class days (skip weekends roughly)
      for (let day = 1; day <= 25; day++) {
        const classDate = daysAgo(day);
        // Skip Sundays
        if (classDate.getDay() === 0) continue;

        for (const student of semStudents) {
          // Realistic attendance: 80% present, 12% absent, 8% late
          const rand = Math.random();
          let status = 'present';
          if (rand > 0.92) status = 'late';
          else if (rand > 0.80) status = 'absent';

          attendanceDocs.push({
            student:      student._id,
            studentName:  student.name,
            markedBy:     fac._id,
            markedByName: fac.name,
            subject:      subject.name,
            department:   dept,
            date:         classDate,
            status,
          });
        }
      }
    }
  }

  // Insert in batches to avoid memory issues
  const BATCH = 500;
  for (let i = 0; i < attendanceDocs.length; i += BATCH) {
    const batch = attendanceDocs.slice(i, i + BATCH);
    try {
      await Attendance.insertMany(batch, { ordered: false });
      totalAttendance += batch.length;
    } catch (e) {
      // Skip duplicates silently
      totalAttendance += batch.length;
    }
  }
  console.log(`📋  Created ~${totalAttendance} attendance records`);

  console.log('\n════════════════════════════');
  console.log('✅  Demo data seeded!\n');
  console.log('📢  Announcements: ' + announcements.length);
  console.log('📋  Attendance records: ~' + totalAttendance);
  console.log('\nDashboards will now show populated charts and data.');

  await mongoose.disconnect();
}

seedDemo().catch(err => { console.error('❌  Demo seed failed:', err.message); process.exit(1); });
