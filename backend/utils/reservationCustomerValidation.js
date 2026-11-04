const { parsePhoneNumberFromString } = require("libphonenumber-js/max");

function normalizeReservationCustomer(customerName, contactNumber, countryCode) {
  const name = typeof customerName === "string" ? customerName.trim() : "";
  const contact = typeof contactNumber === "string" ? contactNumber.trim() : "";
  const country = typeof countryCode === "string" ? countryCode.trim().toUpperCase() : "";

  if (!name) {
    throw new Error("Full name is required.");
  }

  if (!contact) {
    throw new Error("Contact number is required.");
  }

  if (!contact.startsWith("+")) {
    throw new Error("Contact number must include a country code.");
  }

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("Select a valid phone country.");
  }

  const phoneNumber = parsePhoneNumberFromString(contact);
  if (!phoneNumber || !phoneNumber.isValid() || phoneNumber.country !== country) {
    throw new Error("Enter a valid international contact number.");
  }

  return {
    customerName: name,
    contactNumber: phoneNumber.format("E.164"),
    countryCode: country.toLowerCase(),
  };
}

module.exports = { normalizeReservationCustomer };
