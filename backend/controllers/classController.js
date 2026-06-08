const Class = require('../models/Class');
const { success, error } = require('../utils/response');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.boardId) filter.boardId = req.query.boardId;
    const classes = await Class.find(filter).populate('boardId', 'name').sort({ sortOrder: 1 });
    return success(res, 'Classes fetched', classes);
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    const cls = await Class.create(req.body);
    return success(res, 'Class created', cls, 201);
  } catch (err) { return error(res, err.message, 500); }
};

exports.update = async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cls) return error(res, 'Class not found', 404);
    return success(res, 'Class updated', cls);
  } catch (err) { return error(res, err.message, 500); }
};

exports.remove = async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    return success(res, 'Class deleted');
  } catch (err) { return error(res, err.message, 500); }
};
