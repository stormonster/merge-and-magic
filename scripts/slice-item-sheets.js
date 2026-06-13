const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'items', 'source-sheets');
const OUTPUT_SIZE = 128;
const CHANNELS = 4;

const CHROMA_KEY = { red: 255, green: 0, blue: 255 };
const TRANSPARENT_DISTANCE = 38;
const OPAQUE_DISTANCE = 130;
const HALO_DISTANCE = 190;
const HALO_PASSES = 3;

const sheets = [
  {
    source: 'weapons-sheet.png',
    outputDir: path.join(ROOT, 'assets', 'items', 'weapons'),
    prefix: 'weapon',
    columns: 4,
    rows: 4,
    count: 14,
    insetRatio: 0.01
  },
  {
    source: 'armor-sheet.png',
    outputDir: path.join(ROOT, 'assets', 'items', 'armor'),
    prefix: 'armor',
    columns: 4,
    rows: 4,
    count: 16,
    insetRatio: 0.01
  },
  {
    source: 'accessories-sheet.png',
    outputDir: path.join(ROOT, 'assets', 'items', 'accessories'),
    prefix: 'accessory',
    columns: 4,
    rows: 4,
    count: 16,
    insetRatio: 0.01
  },
  {
    source: 'unique-sheet.png',
    outputDir: path.join(ROOT, 'assets', 'items', 'unique'),
    prefix: 'unique',
    columns: 4,
    rows: 2,
    count: 8,
    insetRatio: 0.01
  },
  {
    source: 'unique-expansion-sheet.png',
    outputDir: path.join(ROOT, 'assets', 'items', 'unique'),
    prefix: 'unique',
    columns: 5,
    rows: 4,
    count: 19,
    startIndex: 9,
    insetRatio: 0.01
  }
];

async function cleanOutputDir(outputDir) {
  await fs.mkdir(outputDir, { recursive: true });
  const entries = await fs.readdir(outputDir);
  await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.png'))
      .map((entry) => fs.unlink(path.join(outputDir, entry)))
  );
}

function getCellBox(metadata, columns, rows, index) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const left = Math.round((metadata.width * column) / columns);
  const top = Math.round((metadata.height * row) / rows);
  const right = Math.round((metadata.width * (column + 1)) / columns);
  const bottom = Math.round((metadata.height * (row + 1)) / rows);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top
  };
}

function getInnerCellBox(cellBox, insetRatio) {
  const insetX = Math.round(cellBox.width * insetRatio);
  const insetY = Math.round(cellBox.height * insetRatio);

  return {
    left: cellBox.left + insetX,
    top: cellBox.top + insetY,
    width: cellBox.width - insetX * 2,
    height: cellBox.height - insetY * 2
  };
}

function getPixelOffset(x, y, width) {
  return (y * width + x) * CHANNELS;
}

function getColorDistance(data, offset) {
  const red = data[offset] - CHROMA_KEY.red;
  const green = data[offset + 1] - CHROMA_KEY.green;
  const blue = data[offset + 2] - CHROMA_KEY.blue;

  return Math.sqrt(red * red + green * green + blue * blue);
}

function removeChromaKey(data, width, height) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = getPixelOffset(x, y, width);
      const distance = getColorDistance(data, offset);

      if (distance <= TRANSPARENT_DISTANCE) {
        data[offset + 3] = 0;
        continue;
      }

      if (distance < OPAQUE_DISTANCE) {
        const alphaRatio = (distance - TRANSPARENT_DISTANCE) / (OPAQUE_DISTANCE - TRANSPARENT_DISTANCE);
        const alpha = Math.min(data[offset + 3], Math.round(alphaRatio * 255));
        const normalizedAlpha = alpha / 255;

        data[offset] = Math.max(0, Math.min(255, Math.round((data[offset] - CHROMA_KEY.red * (1 - normalizedAlpha)) / normalizedAlpha)));
        data[offset + 1] = Math.max(0, Math.min(255, Math.round((data[offset + 1] - CHROMA_KEY.green * (1 - normalizedAlpha)) / normalizedAlpha)));
        data[offset + 2] = Math.max(0, Math.min(255, Math.round((data[offset + 2] - CHROMA_KEY.blue * (1 - normalizedAlpha)) / normalizedAlpha)));
        data[offset + 3] = alpha;
      }
    }
  }
}

function isChromaHalo(data, offset) {
  if (data[offset + 3] === 0) {
    return false;
  }

  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const distance = getColorDistance(data, offset);
  const magentaLean = red > 90 && blue > 80 && green < 80 && Math.abs(red - blue) < 100;

  return distance < HALO_DISTANCE || magentaLean;
}

function touchesTransparentNeighbor(data, width, height, x, y) {
  const neighbors = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ];

  return neighbors.some(([neighborX, neighborY]) => {
    if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) {
      return true;
    }

    return data[getPixelOffset(neighborX, neighborY, width) + 3] === 0;
  });
}

function removeChromaHalo(data, width, height) {
  for (let pass = 0; pass < HALO_PASSES; pass += 1) {
    const offsetsToClear = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = getPixelOffset(x, y, width);
        if (isChromaHalo(data, offset) && touchesTransparentNeighbor(data, width, height, x, y)) {
          offsetsToClear.push(offset);
        }
      }
    }

    if (offsetsToClear.length === 0) {
      return;
    }

    offsetsToClear.forEach((offset) => {
      data[offset + 3] = 0;
    });
  }
}

async function sliceSheet(sheet) {
  const sourcePath = path.join(SOURCE_DIR, sheet.source);
  const image = sharp(sourcePath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${sourcePath}`);
  }

  for (let index = 0; index < sheet.count; index += 1) {
    const cellBox = getCellBox(metadata, sheet.columns, sheet.rows, index);
    const box = getInnerCellBox(cellBox, sheet.insetRatio);
    const outputIndex = (sheet.startIndex || 1) + index;
    const filename = `${sheet.prefix}-${String(outputIndex).padStart(2, '0')}.png`;
    const outputPath = path.join(sheet.outputDir, filename);

    const { data, info } = await sharp(sourcePath)
      .extract(box)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: 'contain',
        background: { r: 255, g: 0, b: 255, alpha: 1 }
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    removeChromaKey(data, info.width, info.height);
    removeChromaHalo(data, info.width, info.height);

    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: CHANNELS
      }
    })
      .png()
      .toFile(outputPath);
  }

  console.log(`Sliced ${sheet.count} icons from ${sheet.source}`);
}

async function main() {
  const outputDirs = [...new Set(sheets.map((sheet) => sheet.outputDir))];
  for (const outputDir of outputDirs) {
    await cleanOutputDir(outputDir);
  }

  for (const sheet of sheets) {
    await sliceSheet(sheet);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
