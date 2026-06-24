const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Board = require('../models/Board');
const Class = require('../models/Class');
const Language = require('../models/Language');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Topic = require('../models/Topic');
const Question = require('../models/Question');
const Subscription = require('../models/Subscription');
const SubscriptionPurchase = require('../models/SubscriptionPurchase');
const User = require('../models/User');
const AnswerSubmission = require('../models/AnswerSubmission');
const Evaluation = require('../models/Evaluation');
const StudentProgress = require('../models/StudentProgress');
const Result = require('../models/Result');
const ChapterTranslation = require('../models/ChapterTranslation');
const TopicTranslation = require('../models/TopicTranslation');
const QuestionTranslation = require('../models/QuestionTranslation');
const { sendOTPEmail } = require('../utils/mailer');
const { success, error } = require('../utils/response');
const {
  getBoardLanguages,
  id,
  resolveLanguageId,
  withLocalizedFields,
} = require('../utils/translations');

const appOtpStore = {};
const uploadsRoot = path.join(__dirname, '../uploads');

function answerUploadPathFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl).pathname;
  } catch (err) {}
  const match = pathname.match(/(?:\/uploads\/answers|\/api\/v1\/app\/media\/answers)\/([^/?#]+)$/);
  if (!match) return null;
  const filePath = path.join(uploadsRoot, 'answers', path.basename(match[1]));
  return filePath.startsWith(path.join(uploadsRoot, 'answers')) ? filePath : null;
}

function deleteAnswerUpload(imageUrl) {
  const filePath = answerUploadPathFromUrl(imageUrl);
  if (!filePath) return;
  fs.unlink(filePath, err => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Failed to delete answer upload ${filePath}:`, err);
    }
  });
}

function deleteUploadedFile(file) {
  if (!file?.path) return;
  fs.unlink(file.path, err => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Failed to delete uploaded file ${file.path}:`, err);
    }
  });
}

function generateToken(userId) {
  return jwt.sign({ id: userId, type: 'user' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    boardId: user.boardId,
    classId: user.classId,
    languageId: user.languageId,
    subscriptionId: user.subscriptionId,
    subscriptionExpiry: user.subscriptionExpiry,
  };
}

function hasActiveSubscription(user) {
  return Boolean(user?.subscriptionId && (!user.subscriptionExpiry || new Date(user.subscriptionExpiry) >= new Date()));
}

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

function subscriptionScope(req) {
  if (!hasActiveSubscription(req.user)) return null;
  return {
    boardId: id(req.user.boardId),
    classId: id(req.user.classId),
    subscriptionId: id(req.user.subscriptionId),
  };
}

function applyPurchasedScope(req, filter) {
  const scope = subscriptionScope(req);
  if (!scope?.boardId || !scope?.classId) return false;
  filter.boardId = scope.boardId;
  filter.classId = scope.classId;
  return true;
}

async function ensureQuestionInSubscription(req, questionId) {
  const scope = subscriptionScope(req);
  if (!scope?.boardId || !scope?.classId) {
    throw new Error('Please purchase a class subscription to access questions');
  }
  const question = await Question.findOne({
    _id: questionId,
    boardId: scope.boardId,
    classId: scope.classId,
    isActive: true,
  });
  if (!question) throw new Error('Question is not available in your subscription');
  return question;
}

async function buildProgress(user) {
  const scope = {
    boardId: id(user.boardId),
    classId: id(user.classId),
  };
  if (!scope.boardId || !scope.classId) {
    return {
      overall: {
        completedQuestions: 0,
        totalQuestions: 0,
        completedSubjects: 0,
        totalSubjects: 0,
        completedTopics: 0,
        totalTopics: 0,
        percentage: 0,
      },
      subjects: [],
      completedTopics: 0,
      totalTopics: 0,
      pendingQuestions: 0,
      submittedAnswers: 0,
    };
  }

  const subjects = await Subject.find({ boardId: scope.boardId, classId: scope.classId, isActive: true })
    .select('_id name')
    .sort({ name: 1 })
    .lean();
  const subjectIds = subjects.map(subject => subject._id);
  const chapters = await Chapter.find({ boardId: scope.boardId, classId: scope.classId, subjectId: { $in: subjectIds }, isActive: true })
    .select('_id subjectId')
    .lean();
  const chapterIds = chapters.map(chapter => chapter._id);
  const topics = await Topic.find({ chapterId: { $in: chapterIds }, isActive: true })
    .select('_id chapterId name sortOrder')
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  const topicIds = topics.map(topic => topic._id);
  const topicQuestionStats = topicIds.length
    ? await Question.aggregate([
        {
          $match: {
            boardId: scope.boardId,
            classId: scope.classId,
            topicId: { $in: topicIds },
            isActive: true,
          },
        },
        {
          $lookup: {
            from: AnswerSubmission.collection.name,
            let: { questionId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$studentId', user._id] },
                      { $eq: ['$questionId', '$$questionId'] },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'submissions',
          },
        },
        {
          $group: {
            _id: '$topicId',
            totalQuestions: { $sum: 1 },
            completedQuestions: {
              $sum: { $cond: [{ $gt: [{ $size: '$submissions' }, 0] }, 1, 0] },
            },
          },
        },
      ])
    : [];
  const questionStatsByTopic = new Map(topicQuestionStats.map(row => [String(row._id), row]));

  const topicsBySubject = new Map();
  const chapterSubjectById = new Map(chapters.map(chapter => [String(chapter._id), String(chapter.subjectId)]));
  topics.forEach(topic => {
    const key = chapterSubjectById.get(String(topic.chapterId));
    if (!key) return;
    if (!topicsBySubject.has(key)) topicsBySubject.set(key, []);
    topicsBySubject.get(key).push(topic);
  });

  const subjectProgress = subjects.map(subject => {
    const subjectTopics = topicsBySubject.get(String(subject._id)) || [];
    const completedTopics = subjectTopics.filter(topic => {
      const stats = questionStatsByTopic.get(String(topic._id));
      return stats?.totalQuestions > 0 && stats.completedQuestions >= stats.totalQuestions;
    }).length;
    const topicDetails = subjectTopics.map(topic => {
      const stats = questionStatsByTopic.get(String(topic._id)) || { completedQuestions: 0, totalQuestions: 0 };
      return {
        topicId: topic._id,
        name: topic.name,
        completedQuestions: stats.completedQuestions,
        totalQuestions: stats.totalQuestions,
        percentage: pct(stats.completedQuestions, stats.totalQuestions),
      };
    });
    return {
      subjectId: subject._id,
      name: subject.name,
      completedTopics,
      totalTopics: subjectTopics.length,
      percentage: pct(completedTopics, subjectTopics.length),
      topics: topicDetails,
    };
  });

  const completedSubjects = subjectProgress.filter(subject => subject.totalTopics > 0 && subject.completedTopics === subject.totalTopics).length;
  const completedTopics = subjectProgress.reduce((sum, subject) => sum + subject.completedTopics, 0);
  const totalTopics = subjectProgress.reduce((sum, subject) => sum + subject.totalTopics, 0);
  const totalQuestions = topicQuestionStats.reduce((sum, row) => sum + row.totalQuestions, 0);
  const submittedAnswers = topicQuestionStats.reduce((sum, row) => sum + row.completedQuestions, 0);
  const summary = {
    overall: {
      completedQuestions: submittedAnswers,
      totalQuestions,
      completedSubjects,
      totalSubjects: subjects.length,
      completedTopics,
      totalTopics,
      percentage: pct(submittedAnswers, totalQuestions),
    },
    subjects: subjectProgress,
    completedTopics,
    totalTopics,
    pendingQuestions: Math.max(totalQuestions - submittedAnswers, 0),
    submittedAnswers,
  };

  StudentProgress.findOneAndUpdate(
    { studentId: user._id, boardId: scope.boardId, classId: scope.classId, subjectId: null, topicId: null },
    {
      ...summary.overall,
      boardId: scope.boardId,
      classId: scope.classId,
      studentId: user._id,
      lastActivityAt: new Date(),
    },
    { upsert: true, new: true }
  ).catch(err => {
    console.error(`Progress cache update failed for user ${user._id}:`, err);
  });

  return summary;
}

async function getTopicProgressMap(req, topicIds) {
  const scope = subscriptionScope(req);
  const ids = [...new Set((topicIds || []).filter(Boolean).map(String))];
  const progressMap = new Map(ids.map(topicId => [topicId, {
    completedQuestions: 0,
    totalQuestions: 0,
    percentage: 0,
    isCompleted: false,
    readOnly: false,
  }]));
  if (!ids.length || !scope?.boardId || !scope?.classId) return progressMap;

  const questions = await Question.find({
    boardId: scope.boardId,
    classId: scope.classId,
    topicId: { $in: ids },
    isActive: true,
  }).select('_id topicId');
  const questionIds = questions.map(question => question._id);
  const submissions = await AnswerSubmission.find({
    studentId: req.user._id,
    questionId: { $in: questionIds },
  }).select('questionId topicId status imageUrl submittedAt');
  const completedQuestionIds = new Set(submissions.map(submission => String(submission.questionId)));
  const storedProgress = await StudentProgress.find({
    studentId: req.user._id,
    boardId: scope.boardId,
    classId: scope.classId,
    topicId: { $in: ids },
  }).select('topicId completedQuestions totalQuestions percentage');
  const storedByTopic = new Map(storedProgress.map(row => [String(row.topicId), row]));

  ids.forEach(topicId => {
    const topicQuestions = questions.filter(question => String(question.topicId) === topicId);
    const completedQuestions = topicQuestions.filter(question => completedQuestionIds.has(String(question._id))).length;
    const stored = storedByTopic.get(topicId);
    const totalQuestions = Math.max(topicQuestions.length, stored?.totalQuestions || 0);
    const storedCompleted = stored?.percentage >= 100;
    const isCompleted = storedCompleted || (totalQuestions > 0 && completedQuestions >= totalQuestions);
    progressMap.set(topicId, {
      completedQuestions: Math.max(completedQuestions, stored?.completedQuestions || 0),
      totalQuestions,
      percentage: isCompleted ? 100 : pct(completedQuestions, totalQuestions),
      isCompleted,
      readOnly: false,
    });
  });

  return progressMap;
}

async function withTopicProgress(items, req) {
  const list = Array.isArray(items) ? items : [items];
  const topicIds = list.map(item => String(item._id || item.topicId)).filter(Boolean);
  const progressMap = await getTopicProgressMap(req, topicIds);
  const decorated = list.map(item => {
    const plain = item?.toObject ? item.toObject() : { ...item };
    const progress = progressMap.get(String(plain._id || plain.topicId)) || {
      completedQuestions: 0,
      totalQuestions: 0,
      percentage: 0,
      isCompleted: false,
      readOnly: false,
    };
    return {
      ...plain,
      progress,
      isCompleted: progress.isCompleted,
      readOnly: progress.readOnly,
    };
  });
  return Array.isArray(items) ? decorated : decorated[0];
}

async function withSubjectProgress(subjects, req) {
  const scope = subscriptionScope(req);
  if (!scope?.boardId || !scope?.classId || !subjects.length) return subjects;
  const subjectIds = subjects.map(subject => String(subject._id));
  const chapters = await Chapter.find({
    boardId: scope.boardId,
    classId: scope.classId,
    subjectId: { $in: subjectIds },
    isActive: true,
  }).select('_id subjectId');
  const topics = await Topic.find({
    chapterId: { $in: chapters.map(chapter => chapter._id) },
    isActive: true,
  }).select('_id chapterId');
  const progressMap = await getTopicProgressMap(req, topics.map(topic => topic._id));
  const chapterById = new Map(chapters.map(chapter => [String(chapter._id), chapter]));
  const topicsBySubject = new Map();
  topics.forEach(topic => {
    const chapter = chapterById.get(String(topic.chapterId));
    if (!chapter) return;
    const subjectId = String(chapter.subjectId);
    if (!topicsBySubject.has(subjectId)) topicsBySubject.set(subjectId, []);
    topicsBySubject.get(subjectId).push(topic);
  });

  return subjects.map(subject => {
    const plain = subject?.toObject ? subject.toObject() : { ...subject };
    const subjectTopics = topicsBySubject.get(String(plain._id)) || [];
    const completedTopics = subjectTopics.filter(topic => progressMap.get(String(topic._id))?.isCompleted).length;
    const totalTopics = subjectTopics.length;
    const progress = {
      completedTopics,
      totalTopics,
      percentage: pct(completedTopics, totalTopics),
      isCompleted: totalTopics > 0 && completedTopics >= totalTopics,
      readOnly: totalTopics > 0 && completedTopics >= totalTopics,
    };
    return { ...plain, progress, isCompleted: progress.isCompleted, readOnly: progress.readOnly };
  });
}

async function buildResults(user) {
  const scope = subscriptionScope({ user });
  if (!scope?.boardId || !scope?.classId) {
    return { subjects: [], topics: [], overall: { marksObtained: 0, totalMarks: 0, percentage: 0, grade: 'F' } };
  }
  const evaluations = await Evaluation.find({ studentId: user._id }).populate('subjectId', 'name').populate('topicId', 'name');
  const subjectMap = new Map();
  const topicMap = new Map();
  let marksObtained = 0;
  let totalMarks = 0;
  evaluations.forEach(evaluation => {
    marksObtained += evaluation.marks;
    totalMarks += evaluation.maxMarks;
    const subjectKey = String(evaluation.subjectId?._id || evaluation.subjectId);
    const topicKey = String(evaluation.topicId?._id || evaluation.topicId);
    if (!subjectMap.has(subjectKey)) subjectMap.set(subjectKey, { subjectId: evaluation.subjectId?._id || evaluation.subjectId, name: evaluation.subjectId?.name, marksObtained: 0, totalMarks: 0 });
    if (!topicMap.has(topicKey)) topicMap.set(topicKey, { topicId: evaluation.topicId?._id || evaluation.topicId, name: evaluation.topicId?.name, subjectId: evaluation.subjectId?._id || evaluation.subjectId, marksObtained: 0, totalMarks: 0 });
    subjectMap.get(subjectKey).marksObtained += evaluation.marks;
    subjectMap.get(subjectKey).totalMarks += evaluation.maxMarks;
    topicMap.get(topicKey).marksObtained += evaluation.marks;
    topicMap.get(topicKey).totalMarks += evaluation.maxMarks;
  });

  const normalize = item => ({
    ...item,
    percentage: pct(item.marksObtained, item.totalMarks),
    grade: gradeFromPercentage(pct(item.marksObtained, item.totalMarks)),
  });
  const overallPercentage = pct(marksObtained, totalMarks);
  const overall = { marksObtained, totalMarks, percentage: overallPercentage, grade: gradeFromPercentage(overallPercentage) };

  await Result.findOneAndUpdate(
    { studentId: user._id, boardId: scope.boardId, classId: scope.classId, subjectId: null, topicId: null },
    { studentId: user._id, boardId: scope.boardId, classId: scope.classId, ...overall, generatedAt: new Date() },
    { upsert: true, new: true }
  );

  return {
    subjects: Array.from(subjectMap.values()).map(normalize),
    topics: Array.from(topicMap.values()).map(normalize),
    overall,
  };
}

async function activePlanClassIds(boardId = null) {
  const filter = { isActive: true };
  if (boardId) filter.boardId = boardId;
  return Subscription.distinct('classId', filter);
}

async function selectedLanguageId(req) {
  if (req.query.languageId || req.query.languageCode || req.query.lang || req.query.code) {
    return resolveLanguageId(req);
  }
  return id(req.user?.languageId) || null;
}

async function localizeByBoard(docs, TranslationModel, parentKey, fields, req) {
  const requestedLanguageId = await selectedLanguageId(req);
  const boardIds = [...new Set(docs.map(doc => doc.boardId?._id || doc.boardId).filter(Boolean).map(String))];
  const boardLanguageMap = new Map();
  for (const boardId of boardIds) {
    try {
      boardLanguageMap.set(boardId, await getBoardLanguages(boardId));
    } catch (err) {
      boardLanguageMap.set(boardId, { defaultLanguageId: null });
    }
  }

  const docIds = docs.map(doc => doc._id);
  const translations = await TranslationModel.find({ [parentKey]: { $in: docIds } }).populate('languageId', 'name nativeName code');
  const byDoc = new Map();
  translations.forEach(translation => {
    const key = translation[parentKey].toString();
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key).push(translation);
  });

  return docs.map(doc => {
    const boardId = doc.boardId?._id || doc.boardId;
    const defaultLanguageId = boardLanguageMap.get(String(boardId))?.defaultLanguageId;
    return withLocalizedFields(doc, byDoc.get(doc._id.toString()) || [], requestedLanguageId, defaultLanguageId, fields);
  });
}

async function localizeTopics(topics, req) {
  const requestedLanguageId = await selectedLanguageId(req);
  const chapterIds = [...new Set(topics.map(topic => topic.chapterId?._id || topic.chapterId).filter(Boolean).map(String))];
  const chapters = await Chapter.find({ _id: { $in: chapterIds } });
  const boardByChapter = new Map(chapters.map(chapter => [chapter._id.toString(), chapter.boardId.toString()]));
  const boardIds = [...new Set(chapters.map(chapter => chapter.boardId.toString()))];
  const boardLanguageMap = new Map();
  for (const boardId of boardIds) {
    try {
      boardLanguageMap.set(boardId, await getBoardLanguages(boardId));
    } catch (err) {
      boardLanguageMap.set(boardId, { defaultLanguageId: null });
    }
  }

  const translations = await TopicTranslation.find({ topicId: { $in: topics.map(topic => topic._id) } }).populate('languageId', 'name nativeName code');
  const byTopic = new Map();
  translations.forEach(translation => {
    const key = translation.topicId.toString();
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(translation);
  });

  return topics.map(topic => {
    const chapterId = topic.chapterId?._id || topic.chapterId;
    const boardId = chapterId ? boardByChapter.get(String(chapterId)) : null;
    const defaultLanguageId = boardLanguageMap.get(boardId)?.defaultLanguageId;
    return withLocalizedFields(topic, byTopic.get(topic._id.toString()) || [], requestedLanguageId, defaultLanguageId, ['name', 'description']);
  });
}

exports.sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return error(res, 'Email is required');

    const existing = appOtpStore[email];
    const resendAfter = parseInt(process.env.OTP_RESEND_AFTER) || 60;
    if (existing && Date.now() - existing.sentAt < resendAfter * 1000) {
      const wait = resendAfter - Math.floor((Date.now() - existing.sentAt) / 1000);
      return error(res, `Please wait ${wait} seconds before requesting a new OTP`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMs = (parseInt(process.env.OTP_EXPIRY) || 300) * 1000;
    appOtpStore[email] = {
      otp,
      name: String(req.body.name || '').trim(),
      expiresAt: Date.now() + expiryMs,
      sentAt: Date.now(),
    };

    console.log(`Student OTP requested for ${email}`);
    await sendOTPEmail(email, otp, 'student');
    console.log(`Student OTP sent to ${email}`);
    const data = process.env.NODE_ENV === 'production' ? {} : { devOtp: otp };
    return success(res, 'OTP sent to your email', data);
  } catch (err) {
    console.error('app sendOtp error:', err.message, err.code || '');
    return error(res, 'Failed to send OTP. Check email config.', 500);
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    if (!email || !otp) return error(res, 'Email and OTP are required');

    const record = appOtpStore[email];
    if (!record) return error(res, 'OTP not found. Please request a new one.', 401);
    if (Date.now() > record.expiresAt) {
      delete appOtpStore[email];
      return error(res, 'OTP has expired. Please request a new one.', 401);
    }
    if (record.otp !== otp) return error(res, 'Invalid OTP', 401);

    const update = {
      isVerified: true,
      isActive: true,
      otp: undefined,
      otpExpiry: undefined,
      otpLastSent: new Date(record.sentAt),
    };
    const name = String(req.body.name || record.name || '').trim();
    if (name) update.name = name;

    const user = await User.findOneAndUpdate(
      { email },
      { $set: update, $setOnInsert: { email } },
      { new: true, upsert: true }
    );

    delete appOtpStore[email];
    return success(res, 'Login successful', {
      token: generateToken(user._id),
      user: publicUser(user),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

exports.getMe = async (req, res) => {
  return success(res, 'Profile fetched', publicUser(req.user));
};

exports.updateMe = async (req, res) => {
  try {
    const allowed = ['name', 'languageId'];
    const payload = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) payload[key] = req.body[key] || undefined;
    });
    const user = await User.findByIdAndUpdate(req.user._id, payload, { new: true })
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('languageId', 'name nativeName code')
      .populate('subscriptionId', 'name price durationDays');
    return success(res, 'Profile updated', publicUser(user));
  } catch (err) {
    return error(res, err.message, 500);
  }
};

exports.selectBoardClass = async (req, res) => {
  try {
    const { boardId, classId, languageId } = req.body;
    if (!boardId || !classId) return error(res, 'Board and Class are required');

    const [board, cls] = await Promise.all([
      Board.findOne({ _id: boardId, isActive: true }),
      Class.findOne({ _id: classId, boardId, isActive: true }),
    ]);
    if (!board) return error(res, 'Board not found or inactive', 404);
    if (!cls) return error(res, 'Class not found for selected board', 404);

    const selectedBoardChanged = String(id(req.user.boardId)) !== String(boardId);
    const selectedClassChanged = String(id(req.user.classId)) !== String(classId);
    const payload = { boardId, classId };
    if (languageId) payload.languageId = languageId;
    const update = { $set: payload };
    if (selectedBoardChanged || selectedClassChanged) {
      update.$unset = { subscriptionId: '', subscriptionExpiry: '' };
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true })
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('languageId', 'name nativeName code')
      .populate('subscriptionId', 'name price durationDays');

    return success(res, 'Board and class selected', {
      user: publicUser(user),
      contentLocked: !hasActiveSubscription(user),
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

exports.getLanguages = async (req, res) => {
  try {
    const languages = await Language.find({ isActive: true }).sort({ name: 1 });
    return success(res, 'Languages fetched', languages);
  } catch (err) { return error(res, err.message, 500); }
};

exports.getBoards = async (req, res) => {
  try {
    const filter = { isActive: true };
    const planBoardIds = await Subscription.distinct('boardId', { isActive: true });
    filter._id = { $in: planBoardIds };
    const boards = await Board.find(filter)
      .populate('languageIds', 'name nativeName code')
      .populate('defaultLanguageId', 'name nativeName code')
      .sort({ name: 1 });
    return success(res, 'Boards fetched', boards);
  } catch (err) { return error(res, err.message, 500); }
};

exports.getClasses = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.availablePlans === 'true' || req.query.mode === 'plans') {
      filter._id = { $in: await activePlanClassIds(req.query.boardId) };
    } else {
      const scope = subscriptionScope(req);
      if (!scope?.classId) return success(res, 'Classes fetched', []);
      filter._id = scope.classId;
      filter.boardId = scope.boardId;
    }
    const classes = await Class.find(filter).populate('boardId', 'name fullName').sort({ sortOrder: 1, name: 1 });
    return success(res, 'Classes fetched', classes);
  } catch (err) { return error(res, err.message, 500); }
};

exports.getSubjects = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (!applyPurchasedScope(req, filter)) return error(res, 'Please purchase a class subscription to access subjects', 403);
    if (req.query.subjectId) filter._id = req.query.subjectId;
    const languageId = await selectedLanguageId(req);
    if (languageId) filter.$or = [{ languageId }, { languageIds: languageId }];
    const subjects = await Subject.find(filter)
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('languageIds', 'name nativeName code')
      .populate('languageId', 'name nativeName code')
      .sort({ name: 1 });
    return success(res, 'Subjects fetched', await withSubjectProgress(subjects, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getChapters = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (!applyPurchasedScope(req, filter)) return error(res, 'Please purchase a class subscription to access chapters', 403);
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const chapters = await Chapter.find(filter)
      .populate('boardId', 'name')
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .sort({ sortOrder: 1, name: 1 });
    return success(res, 'Chapters fetched', await localizeByBoard(chapters, ChapterTranslation, 'chapterId', ['name'], req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getTopics = async (req, res) => {
  try {
    const scope = subscriptionScope(req);
    if (!scope?.boardId || !scope?.classId) return error(res, 'Please purchase a class subscription to access topics', 403);
    const filter = { isActive: true };
    if (req.query.chapterId) filter.chapterId = req.query.chapterId;
    if (req.query.chapterId) {
      const chapter = await Chapter.findOne({ _id: req.query.chapterId, boardId: scope.boardId, classId: scope.classId, isActive: true });
      if (!chapter) return error(res, 'Chapter is not available in your subscription', 403);
    } else {
      const chapters = await Chapter.find({ boardId: scope.boardId, classId: scope.classId, isActive: true }).select('_id');
      filter.chapterId = { $in: chapters.map(chapter => chapter._id) };
    }
    const topics = await Topic.find(filter).populate('chapterId', 'name').sort({ sortOrder: 1, name: 1 });
    const localized = await localizeTopics(topics, req);
    return success(res, 'Topics fetched', await withTopicProgress(localized, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getSubjectTopics = async (req, res) => {
  try {
    const scope = subscriptionScope(req);
    if (!scope?.boardId || !scope?.classId) return error(res, 'Please purchase a class subscription to access topics', 403);
    const subject = await Subject.findOne({
      _id: req.params.subjectId,
      boardId: scope.boardId,
      classId: scope.classId,
      isActive: true,
    });
    if (!subject) return error(res, 'Subject is not available in your subscription', 403);
    const chapters = await Chapter.find({
      boardId: scope.boardId,
      classId: scope.classId,
      subjectId: subject._id,
      isActive: true,
    }).select('_id name sortOrder');
    const topics = await Topic.find({ chapterId: { $in: chapters.map(chapter => chapter._id) }, isActive: true })
      .populate('chapterId', 'name sortOrder')
      .sort({ sortOrder: 1, name: 1 });
    const localized = await localizeTopics(topics, req);
    return success(res, 'Subject topics fetched', await withTopicProgress(localized, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getTopicDetail = async (req, res) => {
  try {
    const scope = subscriptionScope(req);
    if (!scope?.boardId || !scope?.classId) return error(res, 'Please purchase a class subscription to access topic content', 403);
    const topic = await Topic.findOne({ _id: req.params.topicId, isActive: true }).populate('chapterId', 'name subjectId boardId classId');
    if (!topic || String(topic.chapterId?.boardId) !== String(scope.boardId) || String(topic.chapterId?.classId) !== String(scope.classId)) {
      return error(res, 'Topic is not available in your subscription', 403);
    }
    await User.findByIdAndUpdate(req.user._id, {
      lastVisitedSubjectId: topic.chapterId.subjectId,
      lastVisitedTopicId: topic._id,
      lastVisitedAt: new Date(),
    });
    return success(res, 'Topic fetched', await withTopicProgress(topic, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getQuestions = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (!applyPurchasedScope(req, filter)) return error(res, 'Please purchase a class subscription to access questions', 403);
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.topicId) filter.topicId = req.query.topicId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate('boardId', 'name')
        .populate('classId', 'name')
        .populate('subjectId', 'name')
        .populate('topicId', 'name')
        .sort({ sortOrder: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Question.countDocuments(filter),
    ]);
    const localized = await localizeByBoard(questions, QuestionTranslation, 'questionId', ['question', 'answer', 'steps'], req);
    const topicId = req.query.topicId || localized[0]?.topicId?._id || localized[0]?.topicId;
    const topicProgress = topicId ? (await getTopicProgressMap(req, [topicId])).get(String(topicId)) : null;
    const submissions = await AnswerSubmission.find({
      studentId: req.user._id,
      questionId: { $in: localized.map(question => question._id) },
    }).select('questionId imageUrl status submittedAt createdAt updatedAt');
    const submissionByQuestion = new Map(submissions.map(submission => [String(submission.questionId), submission]));
    const decorated = localized.map(question => {
      const submission = submissionByQuestion.get(String(question._id)) || null;
      return {
        ...question,
        submission,
        isCompleted: Boolean(submission),
        readOnly: false,
      };
    });
    return success(res, 'Questions fetched', {
      questions: decorated,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      topicProgress,
      readOnly: false,
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.completeTopic = async (req, res) => {
  try {
    const scope = subscriptionScope(req);
    if (!scope?.boardId || !scope?.classId) return error(res, 'Please purchase a class subscription to complete topics', 403);
    const topic = await Topic.findOne({ _id: req.params.topicId, isActive: true });
    if (!topic) return error(res, 'Topic not found', 404);
    const chapter = await Chapter.findOne({ _id: topic.chapterId, boardId: scope.boardId, classId: scope.classId, isActive: true });
    if (!chapter) return error(res, 'Topic is not available in your subscription', 403);

    const questions = await Question.find({
      boardId: scope.boardId,
      classId: scope.classId,
      topicId: topic._id,
      isActive: true,
    }).select('_id');
    const submissions = await AnswerSubmission.find({
      studentId: req.user._id,
      questionId: { $in: questions.map(question => question._id) },
    }).select('questionId');
    const totalQuestions = questions.length;
    const completedQuestions = submissions.length;
    if (!totalQuestions) return error(res, 'Topic has no active questions to complete', 400);
    if (completedQuestions < totalQuestions) {
      return error(res, 'Complete all questions before completing this topic', 400, {
        completedQuestions,
        totalQuestions,
      });
    }

    const progress = await StudentProgress.findOneAndUpdate(
      {
        studentId: req.user._id,
        boardId: scope.boardId,
        classId: scope.classId,
        subjectId: chapter.subjectId,
        topicId: topic._id,
      },
      {
        studentId: req.user._id,
        boardId: scope.boardId,
        classId: scope.classId,
        subjectId: chapter.subjectId,
        topicId: topic._id,
        completedQuestions,
        totalQuestions,
        percentage: 100,
        lastActivityAt: new Date(),
      },
      { upsert: true, new: true }
    );
    buildProgress(req.user).catch(err => {
      console.error(`Progress rebuild failed after topic complete ${topic._id}:`, err);
    });
    return success(res, 'Topic completed', {
      topicId: topic._id,
      subjectId: chapter.subjectId,
      completedQuestions,
      totalQuestions,
      percentage: 100,
      isCompleted: true,
      readOnly: false,
      progress,
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.updateLastVisited = async (req, res) => {
  try {
    const { subjectId, topicId } = req.body;
    if (!topicId) return error(res, 'Topic is required');
    const scope = subscriptionScope(req);
    if (!scope?.boardId || !scope?.classId) return error(res, 'Please purchase a class subscription to resume learning', 403);
    const topic = await Topic.findById(topicId);
    if (!topic) return error(res, 'Topic not found', 404);
    const chapter = await Chapter.findOne({ _id: topic.chapterId, boardId: scope.boardId, classId: scope.classId, isActive: true });
    if (!chapter) return error(res, 'Topic is not available in your subscription', 403);
    const user = await User.findByIdAndUpdate(req.user._id, {
      lastVisitedSubjectId: subjectId || chapter.subjectId,
      lastVisitedTopicId: topicId,
      lastVisitedAt: new Date(),
    }, { new: true }).populate('lastVisitedSubjectId', 'name').populate('lastVisitedTopicId', 'name');
    return success(res, 'Last visited topic updated', {
      lastVisitedSubject: user.lastVisitedSubjectId,
      lastVisitedTopic: user.lastVisitedTopicId,
      lastVisitedAt: user.lastVisitedAt,
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.getResumeLearning = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('lastVisitedSubjectId', 'name')
      .populate('lastVisitedTopicId', 'name description imageUrl notes pdfUrls videoUrls content');
    return success(res, 'Resume learning fetched', {
      subject: user.lastVisitedSubjectId,
      topic: user.lastVisitedTopicId,
      lastVisitedAt: user.lastVisitedAt,
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.submitAnswer = async (req, res) => {
  try {
    if (!req.file) return error(res, 'Answer image is required');
    console.log(`Submit answer started: user=${req.user._id} question=${req.params.questionId} file=${req.file.filename}`);
    const question = await ensureQuestionInSubscription(req, req.params.questionId);
    const imageUrl = `/uploads/answers/${req.file.filename}`;
    const existing = await AnswerSubmission.findOne({
      studentId: req.user._id,
      questionId: question._id,
    });
    const submissionData = {
      studentId: req.user._id,
      boardId: question.boardId,
      classId: question.classId,
      subjectId: question.subjectId,
      topicId: question.topicId,
      questionId: question._id,
      imageUrl,
      status: 'submitted',
      submittedAt: new Date(),
    };
    const submission = existing
      ? await AnswerSubmission.findByIdAndUpdate(existing._id, submissionData, { new: true })
      : await AnswerSubmission.create(submissionData);
    if (existing) {
      const deletedEvaluation = await Evaluation.deleteOne({ submissionId: existing._id });
      if (deletedEvaluation.deletedCount) {
        buildResults(req.user).catch(err => {
          console.error(`Result rebuild failed after reupload ${existing._id}:`, err);
        });
      }
      if (existing.imageUrl && existing.imageUrl !== imageUrl) deleteAnswerUpload(existing.imageUrl);
    }
    buildProgress(req.user).catch(err => {
      console.error(`Progress rebuild failed after submission ${submission._id}:`, err);
    });
    console.log(`Submit answer saved: submission=${submission._id} reupload=${Boolean(existing)}`);
    return success(res, existing ? 'Answer reuploaded' : 'Answer submitted', submission, existing ? 200 : 201);
  } catch (err) {
    deleteUploadedFile(req.file);
    console.error('Submit answer error:', err);
    if (err.code === 11000) return error(res, 'Answer already submitted for this question', 409);
    return error(res, err.message, err.message.includes('subscription') || err.message.includes('available') ? 403 : 500);
  }
};

exports.getSubmissionHistory = async (req, res) => {
  try {
    const filter = { studentId: req.user._id };
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.topicId) filter.topicId = req.query.topicId;
    const submissions = await AnswerSubmission.find(filter)
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('questionId', 'question marks')
      .sort({ submittedAt: -1 });
    const evaluations = await Evaluation.find({ submissionId: { $in: submissions.map(s => s._id) } });
    const evalBySubmission = new Map(evaluations.map(e => [String(e.submissionId), e]));
    return success(res, 'Submission history fetched', submissions.map(submission => ({
      ...submission.toObject(),
      evaluation: evalBySubmission.get(String(submission._id)) || null,
    })));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getProgress = async (req, res) => {
  try {
    if (!hasActiveSubscription(req.user)) return error(res, 'Please purchase a class subscription to view progress', 403);
    return success(res, 'Progress fetched', await buildProgress(req.user));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getResults = async (req, res) => {
  try {
    if (!hasActiveSubscription(req.user)) return error(res, 'Please purchase a class subscription to view results', 403);
    return success(res, 'Results fetched', await buildResults(req.user));
  } catch (err) { return error(res, err.message, 500); }
};

exports.getDashboard = async (req, res) => {
  try {
    const activeSubscription = hasActiveSubscription(req.user) ? req.user.subscriptionId : null;
    const progress = hasActiveSubscription(req.user) ? await buildProgress(req.user) : null;
    const latestResults = hasActiveSubscription(req.user) ? await buildResults(req.user) : null;
    const latestSubmissions = await AnswerSubmission.find({ studentId: req.user._id })
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('questionId', 'question')
      .sort({ submittedAt: -1 })
      .limit(5);
    return success(res, 'Dashboard fetched', {
      user: publicUser(req.user),
      activeSubscription,
      contentLocked: !hasActiveSubscription(req.user),
      overallProgress: progress?.overall || {
        completedQuestions: 0,
        totalQuestions: 0,
        completedSubjects: 0,
        totalSubjects: 0,
        completedTopics: 0,
        totalTopics: 0,
        percentage: 0,
      },
      subjectProgress: progress?.subjects || [],
      pendingQuestions: progress?.pendingQuestions || 0,
      submittedAnswers: progress?.submittedAnswers || latestSubmissions.length,
      latestSubmissions,
      latestResults: latestResults?.overall || null,
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.classId) filter.classId = req.query.classId;
    const subscriptions = await Subscription.find(filter)
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .sort({ price: 1 });
    return success(res, 'Subscriptions fetched', subscriptions);
  } catch (err) { return error(res, err.message, 500); }
};

exports.purchaseSubscription = async (req, res) => {
  try {
    const { subscriptionId, paymentId } = req.body;
    if (!subscriptionId) return error(res, 'Subscription is required');

    const subscription = await Subscription.findOne({ _id: subscriptionId, isActive: true });
    if (!subscription) return error(res, 'Subscription not found or inactive', 404);
    if (!subscription.boardId || !subscription.classId) return error(res, 'Subscription plan is not linked with a board and class', 400);

    const expiryDate = new Date(Date.now() + subscription.durationDays * 24 * 60 * 60 * 1000);
    const purchase = await SubscriptionPurchase.create({
      userId: req.user._id,
      subscriptionId: subscription._id,
      boardId: subscription.boardId,
      classId: subscription.classId,
      amount: subscription.price,
      paymentId: paymentId || `local_${Date.now()}`,
      status: 'success',
      expiryDate,
    });

    const user = await User.findByIdAndUpdate(req.user._id, {
      boardId: subscription.boardId,
      classId: subscription.classId,
      subscriptionId: subscription._id,
      subscriptionExpiry: expiryDate,
    }, { new: true })
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('languageId', 'name nativeName code')
      .populate('subscriptionId', 'name price durationDays boardId classId');

    const populatedPurchase = await SubscriptionPurchase.findById(purchase._id)
      .populate('subscriptionId', 'name price durationDays')
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup');

    return success(res, 'Subscription purchased successfully', {
      purchase: populatedPurchase,
      user: publicUser(user),
    }, 201);
  } catch (err) {
    return error(res, err.message, 500);
  }
};

exports.getMyPurchases = async (req, res) => {
  try {
    const purchases = await SubscriptionPurchase.find({ userId: req.user._id })
      .populate('subscriptionId', 'name price durationDays')
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .sort({ createdAt: -1 });
    return success(res, 'Purchases fetched', purchases);
  } catch (err) { return error(res, err.message, 500); }
};
