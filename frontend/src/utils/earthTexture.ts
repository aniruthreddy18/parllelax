// High-resolution photorealistic NASA Earth-at-night texture generator DataURL
export function getEarthNightTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  // 1. Deep Space Atmospheric Gradient Ocean Base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#040810');
  oceanGrad.addColorStop(0.3, '#070D18');
  oceanGrad.addColorStop(0.5, '#091222');
  oceanGrad.addColorStop(0.7, '#070D18');
  oceanGrad.addColorStop(1, '#040810');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle lat/lng grid lines
  ctx.strokeStyle = 'rgba(37, 51, 64, 0.2)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 2. Realistic Landmass Continents Base (Dark Charcoal Blue tone)
  ctx.fillStyle = '#0D151E';
  ctx.strokeStyle = '#253340';
  ctx.lineWidth = 1.5;

  // Indian Subcontinent & Asia (x: 1300-1650, y: 300-600)
  ctx.beginPath();
  ctx.moveTo(1320, 360); // N Asia
  ctx.lineTo(1520, 380);
  ctx.lineTo(1620, 520); // East Asia / China
  ctx.lineTo(1560, 620); // SE Asia
  ctx.lineTo(1440, 650); // S India / Sri Lanka
  ctx.lineTo(1380, 560); // W India / Gujarat Coast
  ctx.lineTo(1320, 510); // Middle East / Persian Gulf
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Europe & Africa (x: 950-1250, y: 250-750)
  ctx.beginPath();
  ctx.moveTo(1020, 300);
  ctx.lineTo(1220, 320);
  ctx.lineTo(1180, 500);
  ctx.lineTo(1080, 780); // S Africa
  ctx.lineTo(960, 520);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // North & South America (x: 450-850, y: 220-820)
  ctx.beginPath();
  ctx.moveTo(500, 240);
  ctx.lineTo(720, 340);
  ctx.lineTo(780, 520); // Central America
  ctx.lineTo(840, 780); // S America
  ctx.lineTo(680, 700);
  ctx.lineTo(440, 420);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Australia (x: 1550-1750, y: 650-800)
  ctx.beginPath();
  ctx.moveTo(1580, 680);
  ctx.lineTo(1720, 690);
  ctx.lineTo(1740, 780);
  ctx.lineTo(1600, 790);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 3. Nocturnal City Lights (Golden Amber & Warm White Radiance Clusters)
  const drawCityLight = (cx: number, cy: number, radius: number, coreColor = 'rgba(255, 185, 55, 0.95)') => {
    const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    radGrad.addColorStop(0, coreColor);
    radGrad.addColorStop(0.4, 'rgba(232, 169, 58, 0.45)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  // High Density City Lights across India (Gujarat Corridor, Mumbai, Delhi, Bengaluru)
  drawCityLight(1395, 545, 24, 'rgba(255, 200, 80, 1.0)'); // Gujarat Industrial Corridor (Surat, Hazira, Vadodara)
  drawCityLight(1405, 585, 20, 'rgba(255, 185, 55, 0.95)'); // Mumbai & Coastal Konkan
  drawCityLight(1415, 490, 26, 'rgba(255, 185, 55, 0.95)'); // Delhi / NCR Metro
  drawCityLight(1430, 620, 18, 'rgba(255, 185, 55, 0.9)');  // Bengaluru / Chennai Belt
  drawCityLight(1475, 530, 16, 'rgba(255, 185, 55, 0.85)'); // Kolkata / E India

  // Middle East & Persian Gulf Flares
  drawCityLight(1310, 520, 25, 'rgba(255, 107, 53, 0.95)'); // Persian Gulf Flares
  drawCityLight(1290, 480, 18, 'rgba(255, 185, 55, 0.9)');  // Riyadh & Gulf Cities

  // Europe & East Asia
  drawCityLight(1060, 340, 24, 'rgba(255, 185, 55, 0.9)');  // London / W Europe
  drawCityLight(1630, 460, 22, 'rgba(255, 185, 55, 0.9)');  // Tokyo / Japan Megacity
  drawCityLight(1590, 510, 25, 'rgba(255, 185, 55, 0.9)');  // Shanghai / E China

  // North America
  drawCityLight(580, 390, 28, 'rgba(255, 185, 55, 0.95)'); // US BosWash Corridor
  drawCityLight(510, 410, 20, 'rgba(255, 185, 55, 0.85)'); // Chicago / Great Lakes
  drawCityLight(460, 430, 22, 'rgba(255, 185, 55, 0.9)');  // LA / S California

  return canvas.toDataURL('image/jpeg', 0.92);
}
