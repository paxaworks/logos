const sharp = require('sharp');
const path = require('path');

const inputPath = 'C:/Users/pc/Desktop/wa.png';
const outputPath = 'C:/Users/pc/Desktop/Logos/logos-game/public/walk.png';

async function removeWhiteBackground() {
  try {
    const image = sharp(inputPath);
    const { width, height } = await image.metadata();

    console.log(`원본 크기: ${width}x${height}`);

    // 이미지 데이터 가져오기
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });

    // RGBA 버퍼 생성
    const rgbaData = Buffer.alloc(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];

      // 흰색 또는 거의 흰색 픽셀을 투명하게 (임계값 240)
      const isWhite = r > 240 && g > 240 && b > 240;

      rgbaData[i * 4] = r;
      rgbaData[i * 4 + 1] = g;
      rgbaData[i * 4 + 2] = b;
      rgbaData[i * 4 + 3] = isWhite ? 0 : 255; // 투명 또는 불투명
    }

    // 결과 저장
    await sharp(rgbaData, {
      raw: {
        width: width,
        height: height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);

    console.log(`완료! 저장됨: ${outputPath}`);
    console.log(`출력 크기: ${width}x${height} (원본 유지)`);
  } catch (err) {
    console.error('에러:', err);
  }
}

removeWhiteBackground();
