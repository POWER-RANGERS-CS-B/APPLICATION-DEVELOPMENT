const orderModel = require("./orderModel");

exports.getKitchenOrders = () => {
  return orderModel.findKdsOrders();
};
