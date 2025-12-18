const express = require("express");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const fs = require("fs");
const csv = require("csv-parser");
const { Transform } = require("stream");
const app = express();
const results = [];

const transform = new Transform({
  objectMode: true,
  transform(row, enconding, callback) {
    results.push(row);
    callback();
  },
});

function processData(file, res) {
  fs.createReadStream(file, {
    highWaterMark: 32,
  })
    .pipe(csv())
    .pipe(transform)
    .on("data", () => res.send(results));
}

app.listen(3000, () => console.log("Server routing at port 3000"));

app.post("/", upload.single("data"), async (req, res) => {
  processData(req.file.path, res);
});
