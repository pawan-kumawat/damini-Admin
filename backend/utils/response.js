const success = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({ status: true, message, data });
};

const error = (res, message, statusCode = 400, data = null) => {
  return res.status(statusCode).json({ status: false, message, data });
};

module.exports = { success, error };
