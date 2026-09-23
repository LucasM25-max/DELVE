// main.js — the page entry point.
//
// `index.html` loads exactly this module (`<script type="module" src="js/main.js">`),
// which boots the shell. Keeping the entry this thin is deliberate: the boot
// sequence lives in `shell.js`, the data in `data/*.json`, and nothing here needs
// touching when a screen is added.

import { Shell } from './shell.js'
import { Dice, RngStreams } from './core/dice.js'

async function start() {
  const canvas = document.getElementById('screen')
  if (!canvas) throw new Error('index.html is missing <canvas id="screen">')
  const shell = new Shell(canvas)
  window.Delve = window.Delve ?? {}
  window.Delve.dice = Dice
  window.Delve.streams = RngStreams
  window.Delve.shell = shell
  try {
    await shell.boot()
  } catch (error) {
    // A failed fetch is the one unrecoverable boot error: the page depends on
    // `data/` and the art being served next to it.
    console.error('[shell] boot failed:', error)
    const message = document.getElementById('boot-error')
    if (message) {
      message.textContent = `The road is washed out. (${error.message}) Retry?`
      message.hidden = false
    }
    return
  }
  shell.start()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
