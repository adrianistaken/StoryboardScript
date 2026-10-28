import { createDocument } from './utils'

export const createExample = () =>
  createDocument({
    title: 'The case for getting a little lost',
    sourceFilename: 'Example script',
    sections: [
      {
        title: 'A familiar route',
        text: 'Every morning, I take the same walk.\nThe same corner.\nThe same crossing.\nThe same coffee, from the same window.\n\nI could probably do it with my eyes closed.\n\nAnd that might be the problem.',
      },
      {
        title: 'The wrong turn',
        text: 'On Tuesday, the road was closed.\n\nA very ordinary inconvenience.\nBut it pushed me down a street I had never noticed, even though I had lived a block away for three years.\n\nThere was a tiny bookshop.\nA garden growing out of an old bathtub.\nAnd a man repairing a chair on the pavement.\n\n[Wide shot of the unfamiliar street]\n\nI was ten minutes late.\nAnd, for the first time in weeks, fully paying attention.\n\nIt made me wonder how much of a place disappears when we decide we already know it.',
      },
      {
        title: 'Paying attention',
        text: 'A routine makes life easier.\nIt gives our minds room to think about something else.\n\nBut sometimes that something else is just tomorrow’s to-do list.\n\nTaking a different route didn’t transform my life.\nIt just put me back in the one I was actually living.\n\n[Detail shots: a hand-painted sign, rain on leaves, the chair]\n\nYou don’t have to travel very far to find something new.\nSometimes, you only need to turn left.',
      },
      {
        title: 'An invitation',
        text: 'Tomorrow, take the slightly longer way.\nLeave your headphones in your pocket.\nLook up.\n\nAnd see what was there all along.',
      },
    ],
  })
