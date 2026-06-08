const Board = require('../models/Board');
const { success, error } = require('../utils/response');
const { id } = require('../utils/translations');

function normalizeBoardBody(body) {
  const languageIds = Array.isArray(body.languageIds) ? body.languageIds.filter(Boolean) : [];
  const defaultLanguageId = body.defaultLanguageId || languageIds[0];
  if (!languageIds.length) throw new Error('Select at least one board language');
  if (defaultLanguageId && !languageIds.map(String).includes(String(defaultLanguageId))) {
    throw new Error('Default language must be one of the selected board languages');
  }
  return { ...body, languageIds, defaultLanguageId };
}

exports.getAll = async (req, res) => {
  try {
    const boards = await Board.find()
      .populate('languageIds', 'name nativeName code')
      .populate('defaultLanguageId', 'name nativeName code')
      .sort({ createdAt: -1 });
    return success(res, 'Boards fetched', boards);
  } catch (err) { return error(res, err.message, 500); }
};

exports.getOne = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate('languageIds', 'name nativeName code')
      .populate('defaultLanguageId', 'name nativeName code');
    if (!board) return error(res, 'Board not found', 404);
    return success(res, 'Board fetched', board);
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const body = normalizeBoardBody(req.body);
    const board = await Board.create(body);
    return success(res, 'Board created', board, 201);
  } catch (err) { return error(res, err.message, err.message.includes('language') ? 400 : 500); }
};

exports.update = async (req, res) => {
  try {
    const existing = await Board.findById(req.params.id);
    if (!existing) return error(res, 'Board not found', 404);
    const body = normalizeBoardBody({
      ...req.body,
      languageIds: req.body.languageIds || existing.languageIds.map(id),
      defaultLanguageId: req.body.defaultLanguageId || id(existing.defaultLanguageId) || id(existing.languageIds[0]),
    });
    const board = await Board.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!board) return error(res, 'Board not found', 404);
    return success(res, 'Board updated', board);
  } catch (err) { return error(res, err.message, err.message.includes('language') ? 400 : 500); }
};

exports.remove = async (req, res) => {
  try {
    await Board.findByIdAndDelete(req.params.id);
    return success(res, 'Board deleted');
  } catch (err) { return error(res, err.message, 500); }
};
