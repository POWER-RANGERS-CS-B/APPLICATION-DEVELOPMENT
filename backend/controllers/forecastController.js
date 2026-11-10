const forecastService = require("../services/forecastService");

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
    console.error("Reservation forecast freshness check failed:", error.message);
    res.status(503).json({
      message: "Unable to check reservation forecast freshness.",
    });
  }
};

exports.generateForecast = async (req, res) => {
  try {
    const source = req.body?.source || "actual";
    const forecast = await forecastService.generate(source);
    res.json(forecast);
  } catch (error) {
    console.error("Reservation forecast generation failed:", error.message);
    res
      .status(error.status || 503)
      .json({ message: error.message || "Unable to generate reservation forecast." });
  }
};
