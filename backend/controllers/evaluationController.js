const AnswerSubmission = require('../models/AnswerSubmission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');
const Result = require('../models/Result');
const User = require('../models/User');
const { success, error } = require('../utils/response');

function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function gradeFromPercentage(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 75) return 'A';
  if (percentage >= 60) return 'B';
  if (percentage >= 45) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
}

async function refreshOverallResult(studentId) {
  const user = await User.findById(studentId);
  if (!user?.boardId || !user?.classId) return null;
  const evaluations = await Evaluation.find({ studentId });
  const marksObtained = evaluations.reduce((sum, item) => sum + item.marks, 0);
  const totalMarks = evaluations.reduce((sum, item) => sum + item.maxMarks, 0);
  const percentage = pct(marksObtained, totalMarks);
  return Result.findOneAndUpdate(
    { studentId, boardId: user.boardId, classId: user.classId, subjectId: null, topicId: null },
    {
      studentId,
      boardId: user.boardId,
      classId: user.classId,
      marksObtained,
      totalMarks,
      percentage,
      grade: gradeFromPercentage(percentage),
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

exports.getSubmissions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.studentId) filter.studentId = req.query.studentId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.topicId) filter.topicId = req.query.topicId;
    const submissions = await AnswerSubmission.find(filter)
      .populate('studentId', 'name email')
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('questionId', 'question marks')
      .sort({ submittedAt: -1 });
    return success(res, 'Answer submissions fetched', submissions);
  } catch (err) { return error(res, err.message, 500); }
};

exports.getSubmission = async (req, res) => {
  try {
    const submission = await AnswerSubmission.findById(req.params.id)
      .populate('studentId', 'name email')
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('questionId', 'question answer steps marks');
    if (!submission) return error(res, 'Submission not found', 404);
    const evaluation = await Evaluation.findOne({ submissionId: submission._id }).populate('evaluatedBy', 'name email');
    return success(res, 'Submission fetched', { submission, evaluation });
  } catch (err) { return error(res, err.message, 500); }
};

exports.evaluateSubmission = async (req, res) => {
  try {
    const { marks, maxMarks, feedback } = req.body;
    if (marks === undefined) return error(res, 'Marks are required');
    const submission = await AnswerSubmission.findById(req.params.id);
    if (!submission) return error(res, 'Submission not found', 404);
    const question = await Question.findById(submission.questionId);
    const finalMaxMarks = maxMarks === undefined ? (question?.marks || 1) : Number(maxMarks);
    if (Number(marks) < 0 || Number(marks) > finalMaxMarks) return error(res, 'Marks must be between 0 and maxMarks');

    const evaluation = await Evaluation.findOneAndUpdate(
      { submissionId: submission._id },
      {
        submissionId: submission._id,
        studentId: submission.studentId,
        subjectId: submission.subjectId,
        topicId: submission.topicId,
        questionId: submission.questionId,
        marks: Number(marks),
        maxMarks: finalMaxMarks,
        feedback,
        evaluatedBy: req.admin._id,
        evaluatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    submission.status = 'evaluated';
    await submission.save();
    await refreshOverallResult(submission.studentId);
    return success(res, 'Answer evaluated', evaluation);
  } catch (err) { return error(res, err.message, 500); }
};
