// 8-bit image channels have only 256 inputs; avoid three power operations
// per sampled pixel while preserving the exact linear-light calculation.
const linearChannels = Float64Array.from({ length:256 }, (_, channel) => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
});

export function classifyThemePixels(data) {
  let luminance = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    luminance += (.2126 * linearChannels[data[i]] + .7152 * linearChannels[data[i + 1]] + .0722 * linearChannels[data[i + 2]]) * alpha;
    weight += alpha;
  }
  return weight && luminance / weight < .4 ? 'dark' : 'light';
}
