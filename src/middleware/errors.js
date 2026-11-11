function notFound(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500 && !err.expected) {
    console.error(err);
  }
  res.status(status).json({
    error: {
      message: err.publicMessage || 'Something went wrong on our end. Please try again.'
    }
  });
}

module.exports = { notFound, errorHandler };
