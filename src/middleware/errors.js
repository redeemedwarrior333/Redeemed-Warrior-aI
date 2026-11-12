function notFound(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}

function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.publicMessage;
  if (err.type === 'entity.too.large') {
    status = 413;
    message = 'That upload is too large. Please choose a file under 5 MB.';
  }
  if (status >= 500 && !err.expected) {
    console.error(err);
  }
  res.status(status).json({
    error: {
      message: message || 'Something went wrong on our end. Please try again.'
    }
  });
}

module.exports = { notFound, errorHandler };
