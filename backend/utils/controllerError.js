function sendControllerError(
  res,
  error,
  status = error?.statusCode || 500,
  fallbackMessage = "The request could not be completed."
) {
  const statusCode =
    Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
  const internalError = statusCode >= 500 || Boolean(error?.code);

  if (internalError) {
    console.error("API operation failed.", {
      errorType: error?.name || "Error",
      errorCode: error?.code,
    });
  }

  return res.status(statusCode).json({
    message: internalError
      ? fallbackMessage
      : error?.message || "The request could not be completed.",
  });
}

module.exports = { sendControllerError };
