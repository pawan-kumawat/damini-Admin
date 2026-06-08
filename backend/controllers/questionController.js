const Question = require('../models/Question');
const Topic = require('../models/Topic');
const Chapter = require('../models/Chapter');
const QuestionTranslation = require('../models/QuestionTranslation');
const { success, error } = require('../utils/response');
const {
  getBoardLanguages,
  getContentLanguages,
  replaceTranslations,
  resolveLanguageId,
  validateTranslations,
  withLocalizedFields,
} = require('../utils/translations');

function cleanId(value) {
  return value || undefined;
}

async function getQuestionContext(body, existing = null) {
  const topic = await Topic.findById(cleanId(body.topicId) || existing?.topicId);
  if (!topic) throw new Error('Topic not found');
  const chapter = await Chapter.findById(topic.chapterId);
  if (!chapter) throw new Error('Chapter not found');
  return {
    topicId: topic._id,
    boardId: chapter.boardId,
    classId: chapter.classId,
    subjectId: chapter.subjectId,
  };
}

async function localizeQuestions(questions, req) {
  const requestedLanguageId = await resolveLanguageId(req);
  const boardIds = [...new Set(questions.map(q => q.boardId?._id || q.boardId).filter(Boolean).map(String))];
  const boardLanguageMap = new Map();
  for (const boardId of boardIds) {
    try {
      boardLanguageMap.set(boardId, await getBoardLanguages(boardId));
    } catch (err) {
      boardLanguageMap.set(boardId, { defaultLanguageId: null });
    }
  }
  const questionIds = questions.map(q => q._id);
  const translations = await QuestionTranslation.find({ questionId: { $in: questionIds } }).populate('languageId', 'name nativeName code');
  const byQuestion = new Map();
  translations.forEach(t => {
    const key = t.questionId.toString();
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key).push(t);
  });
  return questions.map(q => {
    const boardId = q.boardId?._id || q.boardId;
    const { defaultLanguageId } = boardLanguageMap.get(String(boardId)) || {};
    return withLocalizedFields(q, byQuestion.get(q._id.toString()) || [], requestedLanguageId, defaultLanguageId, ['question', 'answer', 'steps']);
  });
}

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    if (req.query.topicId) filter.topicId = req.query.topicId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate('boardId', 'name')
        .populate('classId', 'name')
        .populate('subjectId', 'name languageIds languageId')
        .populate('topicId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
      Question.countDocuments(filter)
    ]);
    return success(res, 'Questions fetched', { questions: await localizeQuestions(questions, req), total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const context = await getQuestionContext(req.body);
    const { languageIds } = await getContentLanguages({ boardId: context.boardId, subjectId: context.subjectId });
    const translations = validateTranslations(req.body.translations, languageIds, ['question', 'answer']);
    const fallback = translations[0];
    const question = await Question.create({
      topicId: context.topicId,
      boardId: context.boardId,
      classId: context.classId,
      subjectId: context.subjectId,
      difficulty: req.body.difficulty,
      sortOrder: req.body.sortOrder,
      marks: req.body.marks,
      isActive: req.body.isActive,
      question: fallback.question,
      answer: fallback.answer,
      steps: fallback.steps || [],
    });
    await replaceTranslations(QuestionTranslation, 'questionId', question._id, translations, t => ({
      question: t.question.trim(),
      answer: t.answer.trim(),
      steps: Array.isArray(t.steps) ? t.steps.map(s => String(s).trim()).filter(Boolean) : [],
    }));
    return success(res, 'Question created', question, 201);
  } catch (err) { return error(res, err.message, 400); }
};

exports.update = async (req, res) => {
  try {
    const existing = await Question.findById(req.params.id);
    if (!existing) return error(res, 'Question not found', 404);
    const context = await getQuestionContext(req.body, existing);
    const { languageIds } = await getContentLanguages({ boardId: context.boardId, subjectId: context.subjectId });
    const translations = validateTranslations(req.body.translations, languageIds, ['question', 'answer']);
    const fallback = translations[0];
    const question = await Question.findByIdAndUpdate(req.params.id, {
      topicId: context.topicId,
      boardId: context.boardId,
      classId: context.classId,
      subjectId: context.subjectId,
      difficulty: req.body.difficulty,
      sortOrder: req.body.sortOrder,
      marks: req.body.marks,
      isActive: req.body.isActive,
      question: fallback.question,
      answer: fallback.answer,
      steps: fallback.steps || [],
    }, { new: true });
    await replaceTranslations(QuestionTranslation, 'questionId', question._id, translations, t => ({
      question: t.question.trim(),
      answer: t.answer.trim(),
      steps: Array.isArray(t.steps) ? t.steps.map(s => String(s).trim()).filter(Boolean) : [],
    }));
    return success(res, 'Question updated', question);
  } catch (err) { return error(res, err.message, 400); }
};

exports.remove = async (req, res) => {
  try {
    await QuestionTranslation.deleteMany({ questionId: req.params.id });
    await Question.findByIdAndDelete(req.params.id);
    return success(res, 'Question deleted');
  } catch (err) { return error(res, err.message, 500); }
};
