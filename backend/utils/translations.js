const Board = require('../models/Board');
const Language = require('../models/Language');
const Subject = require('../models/Subject');

function id(value) {
  return value?._id ? value._id.toString() : value?.toString();
}

async function resolveLanguageId(req) {
  if (req.query.languageId) return req.query.languageId;
  const code = req.query.languageCode || req.query.lang || req.query.code;
  if (!code) return null;
  const language = await Language.findOne({ code: String(code).trim().toLowerCase() });
  return language?._id || null;
}

async function getBoardLanguages(boardId) {
  const board = await Board.findById(boardId).populate('languageIds', 'name nativeName code');
  if (!board) throw new Error('Board not found');
  const languageIds = (board.languageIds || []).map(id);
  const defaultLanguageId = id(board.defaultLanguageId) || languageIds[0];
  return { board, languageIds, defaultLanguageId };
}

async function getContentLanguages({ boardId, subjectId }) {
  const subject = subjectId ? await Subject.findById(subjectId).populate('languageIds languageId', 'name nativeName code') : null;
  const subjectLanguageIds = subject?.languageIds?.length ? subject.languageIds.map(id) : (subject?.languageId ? [id(subject.languageId)] : []);
  if (subjectLanguageIds.length) {
    return { languageIds: subjectLanguageIds, defaultLanguageId: subjectLanguageIds[0], subject };
  }

  const boardLanguages = await getBoardLanguages(boardId);
  if (!boardLanguages.languageIds.length) {
    throw new Error('Configure a subject language before adding content');
  }
  return { ...boardLanguages, subject };
}

function normalizeTranslations(input) {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];
  return Object.entries(input).map(([languageId, value]) => ({ languageId, ...value }));
}

function validateTranslations(input, languageIds, fields) {
  const translations = normalizeTranslations(input);
  const byLanguage = new Map(translations.map(t => [id(t.languageId), t]));
  for (const languageId of languageIds) {
    const translation = byLanguage.get(languageId);
    if (!translation) throw new Error('Translations are required for every board language');
    for (const field of fields) {
      if (!String(translation[field] || '').trim()) {
        throw new Error(`${field} is required for every board language`);
      }
    }
  }
  return languageIds.map(languageId => ({ ...byLanguage.get(languageId), languageId }));
}

function pickTranslation(translations, requestedLanguageId, defaultLanguageId) {
  const list = translations || [];
  const requested = requestedLanguageId && list.find(t => id(t.languageId) === id(requestedLanguageId));
  if (requested) return requested;
  return list.find(t => id(t.languageId) === id(defaultLanguageId)) || list[0] || null;
}

async function replaceTranslations(Model, parentKey, parentId, translations, mapDoc) {
  await Model.deleteMany({ [parentKey]: parentId });
  if (!translations.length) return [];
  return Model.insertMany(translations.map(t => ({
    [parentKey]: parentId,
    languageId: t.languageId,
    ...mapDoc(t),
  })));
}

function withLocalizedFields(doc, translations, requestedLanguageId, defaultLanguageId, fields) {
  const base = doc.toObject ? doc.toObject() : { ...doc };
  base.translations = translations;
  const selected = pickTranslation(translations, requestedLanguageId, defaultLanguageId);
  if (selected) {
    for (const field of fields) base[field] = selected[field];
    base.selectedLanguageId = id(selected.languageId);
  }
  base.defaultLanguageId = defaultLanguageId;
  return base;
}

module.exports = {
  getBoardLanguages,
  getContentLanguages,
  id,
  pickTranslation,
  replaceTranslations,
  resolveLanguageId,
  validateTranslations,
  withLocalizedFields,
};
