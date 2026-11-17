/**
 * Prediction titles from the source often come as stubs with a blank — "… by...?",
 * "через...?", "a través de...?", "Jensen Huang通过……重新加入NVIDIA ？" — and the card fills the blank
 * with the leading outcome ("22 ноября", "31 de diciembre de 2027").
 *
 * Owner, 17.11: the filled value was glued to the words around it ("через22 ноября",
 * "ateşkesi22 Kasımboyunca", "हुआंग31 दिसंबर, 2027तक") and "……" in Chinese gave the date twice.
 * Now one blank is one value, with a space on each side except next to CJK text or punctuation,
 * and the question mark stays (Spanish «¿…?» keeps its pair).
 */

const CJK = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/;
const BLANK = /[ \t]*(?:\.{2,}|…)+[ \t]*/g;
const NO_SPACE_AFTER = /[\s(\[¿¡«“"'「『（]/; // character before the blank that takes no space
const NO_SPACE_BEFORE = /[\s?？!！,，.。:：;；)\]»”"'」』）]/; // character after the blank that takes no space

export function isPmStubTitle(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  // Any ellipsis in the title is treated as incomplete (incl. mid-phrase "к...? (…)").
  // "___" blanks (Bitcoin above ___ on …) are intentional multi-strike titles — not stubs.
  return /\.{2,}/.test(t) || /…/.test(t);
}

export function expandPmStubTitle(stub, fill) {
  const value = String(fill || '').trim();
  if (!stub || !value) return '';
  const src = String(stub);
  let expanded = src.replace(BLANK, (m, off) => {
    const prev = src.charAt(off - 1);
    const next = src.charAt(off + m.length);
    const before = prev && !NO_SPACE_AFTER.test(prev) && !CJK.test(prev) && !CJK.test(value.charAt(0)) ? ' ' : '';
    const after = next && !NO_SPACE_BEFORE.test(next) && !CJK.test(next) && !CJK.test(value.slice(-1)) ? ' ' : '';
    return before + value + after;
  });
  expanded = expanded
    .replace(/\s+([?？])/g, '$1')
    .replace(/([?？]){2,}/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return (expanded && !isPmStubTitle(expanded)) ? expanded : '';
}
