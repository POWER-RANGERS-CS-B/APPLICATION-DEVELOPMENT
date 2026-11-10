function respondError(res, error, fallbackMessage, defaultStatus = 500) {
  const explicitStatus = Number(error?.statusCode);
  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 500) {
    return res.status(explicitStatus).json({ message: error.message });
  }

  const hasInfrastructureCode = typeof error?.code === "string";
  if (!hasInfrastructureCode && defaultStatus >= 400 && defaultStatus < 500 && error instanceof Error) {
    return res.status(defaultStatus).json({ message: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ message: fallbackMessage });
}

module.exports = respondError;
