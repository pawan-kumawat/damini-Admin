const Language = require('../models/Language');
const { success, error } = require('../utils/response');

exports.getAll = async (req, res) => {
  try {
    const languages = await Language.find().sort({ createdAt: -1 });
    return success(res, 'Languages fetched', languages);
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    req.body.code = req.body.code ? String(req.body.code).trim().toLowerCase() : undefined;
    const lang = await Language.create(req.body);
    return success(res, 'Language created', lang, 201);
  } catch (err) { return error(res, err.message, 500); }
};

exports.update = async (req, res) => {
  try {
    req.body.code = req.body.code ? String(req.body.code).trim().toLowerCase() : undefined;
    const lang = await Language.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lang) return error(res, 'Language not found', 404);
    return success(res, 'Language updated', lang);
  } catch (err) { return error(res, err.message, 500); }
};

exports.remove = async (req, res) => {
  try {
    await Language.findByIdAndDelete(req.params.id);
    return success(res, 'Language deleted');
  } catch (err) { return error(res, err.message, 500); }
};
