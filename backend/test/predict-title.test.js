import test from 'node:test';
import assert from 'node:assert/strict';
import { isPmStubTitle, expandPmStubTitle } from '../src/market/predict-title.js';

// Real stubs from the source (17.11) and the leading outcome the card puts in the blank.
test('prediction titles: the filled-in date is not glued to the words around it', () => {
  assert.equal(expandPmStubTitle('Израиль x Иран прекращение огня продолжается через...?', '22 ноября'),
    'Израиль x Иран прекращение огня продолжается через 22 ноября?');
  assert.equal(expandPmStubTitle('Дженсен Хуан возвращается в NVIDIA...?', '31 декабря 2027 года'),
    'Дженсен Хуан возвращается в NVIDIA 31 декабря 2027 года?');
  assert.equal(expandPmStubTitle('İsrail x İran ateşkesi... boyunca devam ediyor mu?', '22 Kasım'),
    'İsrail x İran ateşkesi 22 Kasım boyunca devam ediyor mu?');
  assert.equal(expandPmStubTitle('¿Jensen Huang se reincorpora a NVIDIA por...?', '31 de diciembre de 2027'),
    '¿Jensen Huang se reincorpora a NVIDIA por 31 de diciembre de 2027?');
  assert.equal(expandPmStubTitle('जेन्सेन हुआंग... तक NVIDIA में फिर से शामिल हो गए?', '31 दिसंबर, 2027'),
    'जेन्सेन हुआंग 31 दिसंबर, 2027 तक NVIDIA में फिर से शामिल हो गए?');
  assert.equal(expandPmStubTitle('Jensen Huang rejoins NVIDIA by...?', 'December 31, 2027'),
    'Jensen Huang rejoins NVIDIA by December 31, 2027?');
});

test('prediction titles: Chinese — no spaces, and "……" is one blank (the date was shown twice)', () => {
  assert.equal(expandPmStubTitle('Jensen Huang通过……重新加入NVIDIA ？', '2027年12月31日'),
    'Jensen Huang通过2027年12月31日重新加入NVIDIA？');
  assert.equal(expandPmStubTitle('以色列x伊朗停火持续到... ？', '11月22日'), '以色列x伊朗停火持续到11月22日？');
});

test('prediction titles: what is not a stub stays as it is', () => {
  assert.equal(isPmStubTitle('Bitcoin above ___ on August 27?'), false);
  assert.equal(isPmStubTitle('Fed decision in December?'), false);
  assert.equal(isPmStubTitle('Will X happen by...?'), true);
  assert.equal(expandPmStubTitle('Will X happen by...?', ''), '');
  assert.equal(expandPmStubTitle('', '22 ноября'), '');
});
