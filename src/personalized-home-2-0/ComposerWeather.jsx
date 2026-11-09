import { createContext, useContext } from 'react';
import './composer-weather.css';

// Shared by home, conversation and widget composers; other wallpapers render nothing.
export const ComposerWeatherContext = createContext(null);

const RAIN_SIZE_SCALE = 1.5;
const drops = [
  [5, 10.8, -3.2, 5], [21, 14.4, -10.1, 3.5], [38, 12.6, -6.8, 6],
  [62, 16.2, -12.4, 4], [81, 13.3, -2.5, 4.5], [95, 11.1, -7.6, 5.5],
];
const beads = [
  [10, 14, 2], [27, 7, 3], [44, 19, 1.5], [55, 10, 2.5],
  [71, 27, 2], [88, 12, 3], [15, 55, 1.5], [91, 63, 2],
];
const snowPatches = [[2, 24, 8, 0], [32, 18, 10, .8], [57, 25, 12, 2], [87, 11, 9, 3]];

export default function ComposerWeather() {
  const weather = useContext(ComposerWeatherContext);
  if (weather === 'snow') return <div key="snow" className="tb-composer-weather is-snow" aria-hidden="true">
    <div className="tb-composer-snow-ledge">
      {snowPatches.map(([left, width, duration, delay], index) => <svg key={index}
        className="tb-composer-snow-patch" viewBox="0 0 100 6" preserveAspectRatio="none"
        style={{ left:`${left}%`, width:`${width}%`, '--snow-duration':`${duration}s`, '--snow-delay':`${delay}s` }}>
        <path className="tb-composer-snow-body" d="M0 4 Q4 3 7 3.4 Q13 2 19 2.5 Q25 .5 31 2 Q39 1 46 2.6 Q53 1.8 59 2.4 Q65 .8 73 2 Q80 1.2 87 2.7 Q95 2.3 100 4 Q84 4.8 72 4.3 Q58 5 45 4.2 Q26 4.8 16 4.2Z"/>
        <path className="tb-composer-snow-light" d="M7 3.4 Q13 2 19 2.5 Q25 .5 31 2 Q39 1 46 2.6 M59 2.4 Q65 .8 73 2 Q80 1.2 87 2.7"/>
      </svg>)}
      {[12, 43, 76, 92].map((left, index) => <span key={left} className="tb-composer-snow-grain"
        style={{ left:`${left}%`, '--snow-delay':`${index * 1.1}s` }}/>) }
    </div>
  </div>;
  if (weather !== 'rain') return null;
  return <div key="rain" className="tb-composer-weather is-rain" aria-hidden="true">
    {beads.map(([left, top, size], index) => <span className="tb-composer-rain-bead" key={`bead-${index}`} style={{
      left:`${left}%`, top:`${top}%`, '--rain-size':`${size * RAIN_SIZE_SCALE}px`,
    }} />)}
    {drops.map(([left, duration, delay, size], index) =>
      <span className="tb-composer-rain-track" key={index} style={{
        left:`${left}%`, '--rain-duration':`${duration}s`, '--rain-delay':`${delay}s`, '--rain-size':`${size * RAIN_SIZE_SCALE}px`,
      }}><span className="tb-composer-raindrop" /></span>
    )}
  </div>;
}
