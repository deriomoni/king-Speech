// Figma 134:167 "Переход · Модуль 2" — stage FX (exported SVG).
// Floor light colour is the placeholder {{FLOOR}} (the next module colour).

export const MT_SPOTLIGHT_SVG = `<svg width="355.222" height="677" viewBox="0 0 355.222 677" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Spotlight" filter="url(#filter0_f_0_34)">
<path d="M147.611 18.5H207.611L336.611 658.5H18.6108L147.611 18.5Z" fill="url(#paint0_linear_0_34)"/>
</g>
<defs>
<filter id="filter0_f_0_34" x="-9.53674e-07" y="0" width="355.222" height="677" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="9" result="effect1_foregroundBlur_0_34"/>
</filter>
<linearGradient id="paint0_linear_0_34" x1="177.611" y1="18.5" x2="177.611" y2="658.5" gradientUnits="userSpaceOnUse">
<stop stop-color="#FFD857" stop-opacity="0.55"/>
<stop offset="0.7" stop-color="#FFD857" stop-opacity="0.1"/>
<stop offset="1" stop-color="#FFD857" stop-opacity="0"/>
</linearGradient>
</defs>
</svg>`;

export const MT_LAMP_SVG = `<svg width="110" height="46" viewBox="0 0 110 46" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Lamp" filter="url(#filter0_f_0_23)">
<ellipse cx="55" cy="23" rx="45" ry="13" fill="#FFF2C2"/>
</g>
<defs>
<filter id="filter0_f_0_23" x="0" y="0" width="110" height="46" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="5" result="effect1_foregroundBlur_0_23"/>
</filter>
</defs>
</svg>`;

export const MT_FLOOR_SVG = `<svg width="340" height="70" viewBox="0 0 340 70" fill="none" xmlns="http://www.w3.org/2000/svg">
<ellipse id="Floor light" cx="170" cy="35" rx="170" ry="35" fill="url(#paint0_radial_0_31)"/>
<defs>
<radialGradient id="paint0_radial_0_31" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(170 35) scale(170 35)">
<stop stop-color="{{FLOOR}}" stop-opacity="0.55"/>
<stop offset="1" stop-color="{{FLOOR}}" stop-opacity="0"/>
</radialGradient>
</defs>
</svg>`;

// 18pt sparkle drawn in a 34pt box (glow padding).
export const MT_SPARKLE_SVG = `<svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="Sparkle" filter="url(#filter0_d_0_22)">
<path d="M17 8L18.6546 15.3454L26 17L18.6546 18.6546L17 26L15.3454 18.6546L8 17L15.3454 15.3454L17 8Z" fill="#FFD857"/>
</g>
<defs>
<filter id="filter0_d_0_22" x="0" y="0" width="34" height="34" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset/>
<feGaussianBlur stdDeviation="4"/>
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.847059 0 0 0 0 0.341176 0 0 0 0.9 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_0_22"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_0_22" result="shape"/>
</filter>
</defs>
</svg>`;
