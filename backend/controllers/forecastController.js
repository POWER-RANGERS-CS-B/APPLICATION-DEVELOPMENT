const forecastService = require("../services/forecastService");
const { sendControllerError } = require("../utils/controllerError");

exports.getForecast = async (req, res) => {
  try {
    const forecast = await forecastService.getLatest();
    res.json(
      forecast
        ? {
            ...forecast,
            developmentDataEnabled: forecastService.developmentDataEnabled(),
          }
        : {
            status: "not_generated",
            developmentDataEnabled: forecastService.developmentDataEnabled(),
          }
    );
  } catch (error) {
    sendControllerError(
      res,
      error,
      503,
      "Unable to check reservation forecast freshness."
    );
  }
};

exports.generateForecast = async (req, res) => {
  try {
    const source = req.body?.source || "actual";
    const forecast = await forecastService.generate(source);
    res.json(forecast);
  } catch (error) {
    sendControllerError(
      res,
      error,
      error.status || 503,
      "Unable to generate reservation forecast."
    );
  }
};
