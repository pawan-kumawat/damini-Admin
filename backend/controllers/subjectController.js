const Subject = require('../models/Subject');
const { success, error } = require('../utils/response');

function normalizeSubjectBody(body) {
  const languageIds = Array.isArray(body.languageIds) ? body.languageIds.filter(Boolean) : [];
  if (body.languageId && !languageIds.includes(body.languageId)) languageIds.push(body.languageId);
  if (!languageIds.length) throw new Error('Select at least one subject language');
  return { ...body, languageIds, languageId: languageIds[0] };
}

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.languageId) filter.$or = [{ languageId: req.query.languageId }, { languageIds: req.query.languageId }];
    const subjects = await Subject.find(filter)
      .populate('boardId', 'name')
      .populate('classId', 'name')
      .populate('languageIds', 'name nativeName code')
      .populate('languageId', 'name nativeName code')
      .sort({ createdAt: -1 });
    return success(res, 'Subjects fetched', subjects);
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const subject = await Subject.create(normalizeSubjectBody(req.body));
    return success(res, 'Subject created', subject, 201);
  } catch (err) { return error(res, err.message, 400); }
};

exports.update = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, normalizeSubjectBody(req.body), { new: true });
    if (!subject) return error(res, 'Subject not found', 404);
    return success(res, 'Subject updated', subject);
  } catch (err) { return error(res, err.message, 400); }
};

exports.remove = async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    return success(res, 'Subject deleted');
  } catch (err) { return error(res, err.message, 500); }
};
