/** Stemmer sanity checks (guards tautology/filler lemma matching). */
import { stemEn, stemRu } from '../core/text/stemmer';

describe('stemRu — inflections collapse to one lemma', () => {
  it('noun declension', () => {
    const forms = ['слово', 'слова', 'словом', 'слову', 'словах'];
    const stems = forms.map(stemRu);
    expect(new Set(stems).size).toBe(1);
    expect(stems[0]).toBe('слов');
  });

  it('adjective agreement', () => {
    const forms = ['красивый', 'красивая', 'красивое', 'красивые', 'красивым'];
    const stems = new Set(forms.map(stemRu));
    expect(stems.size).toBe(1);
  });

  it('does not over-stem short words', () => {
    expect(stemRu('кот')).toBe('кот');
    expect(stemRu('я')).toBe('я');
  });
});

describe('stemEn — classic Porter', () => {
  it('handles common cases', () => {
    expect(stemEn('cats')).toBe('cat');
    expect(stemEn('running')).toBe('run');
    expect(stemEn('happiness')).toBe('happi');
    expect(stemEn('nationalization')).toBe('nation');
  });
});
