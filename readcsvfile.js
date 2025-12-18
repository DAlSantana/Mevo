const fs = require("fs");
const csv = require("csv-parser");
const { Transform } = require("stream");

const readFile = fs.createReadStream("./data.csv", {
  highWaterMark: 32,
});

const results = [];

const transform = new Transform({
  objectMode: true,
  transform(row, enconding, callback) {
    results.push(row);
    callback();
  },
});

readFile.pipe(csv()).pipe(transform);
