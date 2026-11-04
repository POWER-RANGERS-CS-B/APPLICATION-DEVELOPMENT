const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const reservationModel = require("../models/reservationModel");
const reservationRoutes = require("../routes/reservationRoutes");
const db = require("../config/db");
const auditService = require("../services/auditService");

async function withReservationApi(run) {
  const app = express();
  app.use(express.json());
  app.use("/api/reservations", reservationRoutes);
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}/api/reservations`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("reservation API rejects missing customer information before persistence", async () => {
  const originalCreate = reservationModel.create;
  let createCalls = 0;
  reservationModel.create = async () => {
    createCalls += 1;
    return {};
  };

  try {
    await withReservationApi(async (url) => {
      for (const body of [
        {},
        { customer_name: "", contact_number: "+639171234567", contact_country: "ph" },
        { customer_name: "Customer Name", contact_number: " " },
        { customer_name: "   ", contact_number: "   " },
      ]) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        assert.equal(response.status, 400);
        assert.match((await response.json()).message, /required/i);
      }

      assert.equal(createCalls, 0);
    });
  } finally {
    reservationModel.create = originalCreate;
  }
});

test("reservation API rejects invalid international contact numbers before persistence", async () => {
  const originalCreate = reservationModel.create;
  let createCalls = 0;
  reservationModel.create = async () => {
    createCalls += 1;
    return {};
  };

  try {
    await withReservationApi(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: "Customer Name",
          contact_number: "+123456789",
          contact_country: "us",
        }),
      });

      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /valid international contact number/i);
      assert.equal(createCalls, 0);
    });
  } finally {
    reservationModel.create = originalCreate;
  }
});

test("reservation API trims valid customer details before passing them to persistence", async () => {
  const originalCreate = reservationModel.create;
  let savedInput;
  reservationModel.create = async (input) => {
    savedInput = input;
    return { id: 1 };
  };

  try {
    await withReservationApi(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chairIds: [1],
          reservation_date: "2026-11-04",
          reservation_time: "18:00",
          customer_name: "  Customer Name  ",
          contact_number: "  +63 917 123 4567  ",
          contact_country: "ph",
        }),
      });

      assert.equal(response.status, 201);
      assert.equal(savedInput.customerName, "Customer Name");
      assert.equal(savedInput.contactNumber, "+639171234567");
    });
  } finally {
    reservationModel.create = originalCreate;
  }
});

test("reservation API validates and normalizes phone numbers for multiple countries", async () => {
  const originalCreate = reservationModel.create;
  const savedContacts = [];
  reservationModel.create = async (input) => {
    savedContacts.push(input.contactNumber);
    return { id: savedContacts.length };
  };

  try {
    await withReservationApi(async (url) => {
      for (const [contact, country] of [
        ["+639171234567", "ph"],
        ["+14155552671", "us"],
        ["+819012345678", "jp"],
      ]) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: "Customer Name",
            contact_number: contact,
            contact_country: country,
          }),
        });
        assert.equal(response.status, 201);
      }

      assert.deepEqual(savedContacts, [
        "+639171234567",
        "+14155552671",
        "+819012345678",
      ]);
    });
  } finally {
    reservationModel.create = originalCreate;
  }
});

test("reservation API rejects phone numbers without a matching country selection", async () => {
  const originalCreate = reservationModel.create;
  let createCalls = 0;
  reservationModel.create = async () => {
    createCalls += 1;
    return {};
  };

  try {
    await withReservationApi(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: "Customer Name",
          contact_number: "9171234567",
          contact_country: "ph",
        }),
      });

      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /country code/i);

      const mismatchedCountryResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: "Customer Name",
          contact_number: "+14155552671",
          contact_country: "jp",
        }),
      });

      assert.equal(mismatchedCountryResponse.status, 400);
      assert.match((await mismatchedCountryResponse.json()).message, /valid international contact number/i);
      assert.equal(createCalls, 0);
    });
  } finally {
    reservationModel.create = originalCreate;
  }
});

test("reservation model saves and returns the normalized international number", async () => {
  const originalConnect = db.connect;
  const originalInsertAudit = auditService.insert;
  let insertedValues;
  let released = false;
  const returnedReservation = {
    id: 27,
    customer_name: "Customer Name",
    contact_number: "+819012345678",
  };

  db.connect = async () => ({
    async query(sql, values) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (/SELECT table_id/.test(sql)) {
        return { rows: [{ table_id: 8 }] };
      }
      if (/SELECT id, status[\s\S]*FROM restaurant\.chairs/.test(sql)) {
        return { rows: [{ id: 81, status: "vacant" }, { id: 82, status: "vacant" }] };
      }
      if (/SELECT id, status/.test(sql)) {
        return { rows: [{ id: 8, status: "vacant" }] };
      }
      if (/INSERT INTO restaurant\.reservations/.test(sql)) {
        insertedValues = values;
        return { rows: [returnedReservation] };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {
      released = true;
    },
  });
  auditService.insert = async () => {};

  try {
    const reservation = await reservationModel.create({
      chairIds: [81, 82],
      reservationDate: "2026-11-04",
      reservationTime: "18:00",
      customerName: " Customer Name ",
      contactNumber: " +819012345678 ",
      contactCountry: "jp",
    });

    assert.equal(insertedValues[5], "Customer Name");
    assert.equal(insertedValues[6], "+819012345678");
    assert.equal(reservation.contact_number, "+819012345678");
    assert.equal(released, true);
  } finally {
    db.connect = originalConnect;
    auditService.insert = originalInsertAudit;
  }
});
