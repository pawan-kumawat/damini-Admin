const Chapter = require('../models/Chapter');
const ChapterTranslation = require('../models/ChapterTranslation');
const { success, error } = require('../utils/response');
const {
  getBoardLanguages,
  getContentLanguages,
  replaceTranslations,
  resolveLanguageId,
  validateTranslations,
  withLocalizedFields,
} = require('../utils/translations');

async function localizeChapters(chapters, req) {
  const requestedLanguageId = await resolveLanguageId(req);
  const boardIds = [...new Set(chapters.map(ch => ch.boardId?._id || ch.boardId).filter(Boolean).map(String))];
  const boardLanguageMap = new Map();
  for (const boardId of boardIds) {
    try {
      boardLanguageMap.set(boardId, await getBoardLanguages(boardId));
    } catch (err) {
      boardLanguageMap.set(boardId, { defaultLanguageId: null });
    }
  }
  const chapterIds = chapters.map(ch => ch._id);
  const translations = await ChapterTranslation.find({ chapterId: { $in: chapterIds } }).populate('languageId', 'name nativeName code');
  const byChapter = new Map();
  translations.forEach(t => {
    const key = t.chapterId.toString();
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key).push(t);
  });
  return chapters.map(ch => {
    const boardId = ch.boardId?._id || ch.boardId;
    const { defaultLanguageId } = boardLanguageMap.get(String(boardId)) || {};
    return withLocalizedFields(ch, byChapter.get(ch._id.toString()) || [], requestedLanguageId, defaultLanguageId, ['name']);
  });
}

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;
    const chapters = await Chapter.find(filter)
      .populate('boardId', 'name')
      .populate('classId', 'name')
      .populate('subjectId', 'name languageIds languageId')
      .sort({ sortOrder: 1 });
    return success(res, 'Chapters fetched', await localizeChapters(chapters, req));
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const { languageIds } = await getContentLanguages({ boardId: req.body.boardId, subjectId: req.body.subjectId });
    const translations = validateTranslations(req.body.translations, languageIds, ['name']);
    const fallback = translations[0];
    const chapter = await Chapter.create({ ...req.body, name: fallback.name });
    await replaceTranslations(ChapterTranslation, 'chapterId', chapter._id, translations, t => ({ name: t.name.trim() }));
    return success(res, 'Chapter created', chapter, 201);
  } catch (err) { return error(res, err.message, 400); }
};

exports.update = async (req, res) => {
  try {
    const existing = await Chapter.findById(req.params.id);
    if (!existing) return error(res, 'Chapter not found', 404);
    const boardId = req.body.boardId || existing.boardId;
    const { languageIds } = await getContentLanguages({ boardId, subjectId: req.body.subjectId || existing.subjectId });
    const translations = validateTranslations(req.body.translations, languageIds, ['name']);
    const fallback = translations[0];
    const chapter = await Chapter.findByIdAndUpdate(req.params.id, { ...req.body, name: fallback.name }, { new: true });
    await replaceTranslations(ChapterTranslation, 'chapterId', chapter._id, translations, t => ({ name: t.name.trim() }));
    return success(res, 'Chapter updated', chapter);
  } catch (err) { return error(res, err.message, 400); }
};

exports.remove = async (req, res) => {
  try {
    await ChapterTranslation.deleteMany({ chapterId: req.params.id });
    await Chapter.findByIdAndDelete(req.params.id);
    return success(res, 'Chapter deleted');
  } catch (err) { return error(res, err.message, 500); }
};
