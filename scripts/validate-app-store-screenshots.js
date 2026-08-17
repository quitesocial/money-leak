const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const screenshotDirectory = join(
  process.cwd(),
  'assets',
  'app-store',
  'ios',
  'en-US',
  '6.9',
);
const expectedFiles = [
  '01-see-where-money-goes.jpg',
  '02-spot-draining-habits.jpg',
  '03-add-income-or-spending-fast.jpg',
  '04-explore-spending.jpg',
  '05-clear-insights.jpg',
];
const expectedDimensions = { width: 1320, height: 2868 };
const startOfFrameMarkers = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function fail(message) {
  throw new Error(`App Store screenshot validation failed: ${message}`);
}

function readJpegDimensions(filePath) {
  const bytes = readFileSync(filePath);

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    fail(`${filePath} is not a valid JPEG file`);
  }

  let offset = 2;

  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;

    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset += 1;

    if (
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      continue;
    }

    if (offset + 1 >= bytes.length) break;

    const segmentLength = bytes.readUInt16BE(offset);

    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      fail(`${filePath} contains a malformed JPEG segment`);
    }

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) fail(`${filePath} has an invalid JPEG frame`);

      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  fail(`${filePath} does not contain JPEG dimensions`);
}

const actualFiles = readdirSync(screenshotDirectory).sort();

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  fail(
    `expected exactly ${expectedFiles.join(', ')}, received ${actualFiles.join(', ')}`,
  );
}

for (const fileName of expectedFiles) {
  const filePath = join(screenshotDirectory, fileName);
  const fileSize = statSync(filePath).size;

  if (fileSize === 0) fail(`${fileName} is empty`);

  const dimensions = readJpegDimensions(filePath);

  if (
    dimensions.width !== expectedDimensions.width ||
    dimensions.height !== expectedDimensions.height
  ) {
    fail(
      `${fileName} is ${dimensions.width}x${dimensions.height}; expected 1320x2868`,
    );
  }

  console.log(
    `PASS ${fileName}: ${dimensions.width}x${dimensions.height}, JPEG, ${fileSize} bytes`,
  );
}

console.log(`PASS ${expectedFiles.length} App Store screenshots validated.`);
