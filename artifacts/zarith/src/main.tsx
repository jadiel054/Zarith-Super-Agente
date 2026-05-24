import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import {
  orbit,
  ring,
  ring2,
  waveform,
  lineWobble,
  dotPulse,
  bouncy,
} from "ldrs";

orbit.register();
ring.register();
ring2.register();
waveform.register();
lineWobble.register();
dotPulse.register();
bouncy.register();

createRoot(document.getElementById("root")!).render(<App />);
