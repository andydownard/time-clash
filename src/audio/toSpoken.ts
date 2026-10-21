// Turns on-screen question text into words a text-to-speech voice reads well. Used for the AUDIO only.
// The caption and the clip id always use the original text (see clipId.ts).
export function toSpoken(text: string): string {
  return text
    .replace(/_{2,}/g, ' blank ')
    .replace(/\?\s*\/\s*(\d+)/g, ' blank over $1')
    .replace(/●/g, ' dot, ')
    .replace(/\s<\s/g, ' is less than ')
    .replace(/\s>\s/g, ' is greater than ')
    .replace(/(?<=\w)-(?=[\s.,?!"'])/g, '')
    .replace(/(?<=[\s"'])-(?=[a-z])/g, '')
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/(\d)\s*x\s*(?=[\d(])/g, '$1 times ')
    .replace(/(\))\s*x\s*(?=[\d(])/g, '$1 times ')
    .replace(/(\d+)\/(\d+)/g, '$1 over $2')
    .replace(/\s\/\s/g, ' divided by ')
    .replace(/\^2\b/g, ' squared')
    .replace(/\^3\b/g, ' cubed')
    .replace(/\^\(?(-?\d+)\)?/g, ' to the power of $1')
    .replace(/(\d)(x)\b/g, '$1 $2')
    .replace(/(^|[\s(=:])-(?=[\dx(])/g, '$1negative ')
    .replace(/(?<=[\d)x])\s*-\s*(?=[\d(x])/g, ' minus ')
    .replace(/\s\+\s|(?<=\d)\+(?=\d)/g, ' plus ')
    .replace(/\s*=\s*/g, ' equals ')
    .replace(/(\d)\s*%/g, '$1 percent')
    .replace(/\s+([.,?!])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
