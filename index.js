const express = require("express");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const csv = require("csv-parser");
const { Transform } = require("stream");

const app = express();

class ValidationError extends Error {
  constructor(line, field, message, value) {
    super(message);
    this.line = line;
    this.field = field;
    this.value = value;
  }

  toJSON() {
    return {
      line: this.line,
      field: this.field,
      message: this.message,
      value: this.value,
    };
  }
}

function processData(file, res) {
  const results = [];
  const erros = [];
  let rowNumber = 0;

  const transform = new Transform({
    objectMode: true,
    async transform(row, _, callback) {
      rowNumber++;
      const currentRow = rowNumber;

      row.controlled = row.controlled === "true";

      const resultsValidation = await Promise.allSettled([
        validateFutureDate(row.date, currentRow),
        validateMaxDuration(90, row.duration, currentRow),
        validateControlledMedicines(row, currentRow),
      ]);

      resultsValidation
        .filter((result) => result.status === "rejected")
        .forEach((error) => erros.push(error));

      results.push(row);
      callback();
    },
  });

  fs.createReadStream(file)
    .pipe(csv())
    .pipe(transform)
    .on("finish", () => {
      fs.unlink(file, () => {});

      if (erros.length > 0) {
        return res.status(400).json(erros.map((e) => e.reason.toJSON()));
      }

      res.status(200).json(results);
    });
}

app.post("/", upload.single("data"), (req, res) => {
  processData(req.file.path, res);
});

app.listen(3000, () => console.log("Server running on port 3000"));

function validateMaxDuration(maxDays, duration, line) {
  return new Promise((resolve, reject) => {
    const durationNumber = Number(duration);

    if (!durationNumber || durationNumber <= 0) {
      return reject(
        new ValidationError(line, "duration", "Invalid duration", duration)
      );
    }

    if (durationNumber > maxDays) {
      return reject(
        new ValidationError(
          line,
          "duration",
          `Maximum duration is ${maxDays} days`,
          duration
        )
      );
    }

    resolve();
  });
}

function validateFutureDate(date, line) {
  return new Promise((resolve, reject) => {
    const inputDate = new Date(date);
    const today = new Date();

    inputDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (inputDate > today) {
      return reject(
        new ValidationError(line, "date", "Date cannot be in the future", date)
      );
    }

    resolve();
  });
}

function validateControlledMedicines(row, line) {
  const sixtyDays = 60;

  return new Promise((resolve, reject) => {
    if (row.controlled && !row.notes) {
      return reject(
        new ValidationError(
          line,
          "notes",
          "Necessário que os medicamentos tenham notas",
          row.notes
        )
      );
    }

    if (row.controlled && Number(row.duration) > sixtyDays) {
      return reject(
        new ValidationError(
          line,
          "duration",
          "Medicamentos controlados não podem exceder 60 dias",
          row.duration
        )
      );
    }

    resolve();
  });
}
