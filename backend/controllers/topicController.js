const Topic = require('../models/Topic');
const Question = require('../models/Question');
const Chapter = require('../models/Chapter');
const TopicTranslation = require('../models/TopicTranslation');
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

function parseTopicBody(req, existing = null) {
  const body = { ...req.body };
  if (typeof body.translations === 'string') body.translations = JSON.parse(body.translations);
  if (typeof body.sortOrder !== 'undefined') body.sortOrder = parseInt(body.sortOrder) || 0;
  if (typeof body.isActive !== 'undefined') body.isActive = String(body.isActive) === 'true';
  if (req.file) body.imageUrl = `/uploads/topics/${req.file.filename}`;
  if (String(body.removeImage || '') === 'true') body.imageUrl = null;
  delete body.removeImage;
  if (!Object.prototype.hasOwnProperty.call(body, 'imageUrl') && existing) body.imageUrl = existing.imageUrl || null;
  return body;
}

async function localizeTopics(topics, req) {
  const requestedLanguageId = await resolveLanguageId(req);
  const chapterIds = [...new Set(topics.map(t => t.chapterId?._id || t.chapterId).filter(Boolean).map(String))];
  const chapters = await Chapter.find({ _id: { $in: chapterIds } });
  const boardByChapter = new Map(chapters.map(ch => [ch._id.toString(), ch.boardId.toString()]));
  const boardIds = [...new Set(chapters.map(ch => ch.boardId.toString()))];
  const boardLanguageMap = new Map();
  for (const boardId of boardIds) {
    try {
      boardLanguageMap.set(boardId, await getBoardLanguages(boardId));
    } catch (err) {
      boardLanguageMap.set(boardId, { defaultLanguageId: null });
    }
  }
  const topicIds = topics.map(t => t._id);
  const translations = await TopicTranslation.find({ topicId: { $in: topicIds } }).populate('languageId', 'name nativeName code');
  const byTopic = new Map();
  translations.forEach(t => {
    const key = t.topicId.toString();
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(t);
  });
  return topics.map(topic => {
    const chapterId = topic.chapterId?._id || topic.chapterId;
    const boardId = chapterId ? boardByChapter.get(String(chapterId)) : null;
    const defaultLanguageId = boardLanguageMap.get(boardId)?.defaultLanguageId;
    return withLocalizedFields(topic, byTopic.get(topic._id.toString()) || [], requestedLanguageId, defaultLanguageId, ['name', 'description']);
  });
}

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.chapterId) filter.chapterId = req.query.chapterId;
    const topics = await Topic.find(filter)
      .populate('chapterId', 'name')
      .sort({ sortOrder: 1 });
    return success(res, 'Topics fetched', await localizeTopics(topics, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const body = parseTopicBody(req);
    const chapter = await Chapter.findById(body.chapterId);
    if (!chapter) return error(res, 'Chapter not found', 404);
    const { languageIds } = await getContentLanguages({ boardId: chapter.boardId, subjectId: chapter.subjectId });
    const translations = validateTranslations(body.translations, languageIds, ['name']);
    const fallback = translations[0];
    const topic = await Topic.create({ ...body, imageUrl: body.imageUrl || null, name: fallback.name, description: fallback.description });
    await replaceTranslations(TopicTranslation, 'topicId', topic._id, translations, t => ({
      name: t.name.trim(),
      description: String(t.description || '').trim(),
    }));
    return success(res, 'Topic created', topic, 201);
  } catch (err) { return error(res, err.message, 400); }
};

exports.update = async (req, res) => {
  try {
    const existing = await Topic.findById(req.params.id);
    if (!existing) return error(res, 'Topic not found', 404);
    const body = parseTopicBody(req, existing);
    const chapter = await Chapter.findById(body.chapterId || existing.chapterId);
    if (!chapter) return error(res, 'Chapter not found', 404);
    const { languageIds } = await getContentLanguages({ boardId: chapter.boardId, subjectId: chapter.subjectId });
    const translations = validateTranslations(body.translations, languageIds, ['name']);
    const fallback = translations[0];
    const topic = await Topic.findByIdAndUpdate(req.params.id, { ...body, name: fallback.name, description: fallback.description }, { new: true });
    await replaceTranslations(TopicTranslation, 'topicId', topic._id, translations, t => ({
      name: t.name.trim(),
      description: String(t.description || '').trim(),
    }));
    return success(res, 'Topic updated', topic);
  } catch (err) { return error(res, err.message, 400); }
};

exports.remove = async (req, res) => {
  try {
    const topicId = req.params.id;
    const questions = await Question.find({ topicId }).select('_id');
    await QuestionTranslation.deleteMany({ questionId: { $in: questions.map(q => q._id) } });
    await TopicTranslation.deleteMany({ topicId });
    await Question.deleteMany({ topicId });
    await Topic.findByIdAndDelete(topicId);
    return success(res, 'Topic and its questions deleted');
  } catch (err) { return error(res, err.message, 500); }
};
