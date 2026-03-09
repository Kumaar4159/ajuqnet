'use strict';
const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: 100,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      enum: ['Computer Science', 'Electrical & Electronics', 'Mechanical'],
      trim: true,
    },
    semester: {
      type: String,
      required: [true, 'Semester is required'],
      enum: ['1', '2', '3', '4', '5', '6'],
      trim: true,
    },
    // Faculty assigned to teach this subject
    assignedFaculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedFacultyName: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

subjectSchema.index({ department: 1, semester: 1 });
subjectSchema.index({ assignedFaculty: 1 });
subjectSchema.index({ code: 1, department: 1 }, { unique: true });

// Static: get subjects for a faculty by dept+semester
subjectSchema.statics.getForFaculty = function (facultyId, department, semester) {
  const filter = { assignedFaculty: facultyId, isActive: true };
  if (department) filter.department = department;
  if (semester) filter.semester = semester;
  return this.find(filter).sort({ name: 1 });
};

// Static: get all subjects for a dept+semester
subjectSchema.statics.getForDeptSemester = function (department, semester) {
  return this.find({ department, semester, isActive: true })
    .populate('assignedFaculty', 'name email')
    .sort({ code: 1 });
};

const Subject = mongoose.model('Subject', subjectSchema);
module.exports = Subject;
