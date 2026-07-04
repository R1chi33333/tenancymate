import { describe, expect, it } from 'vitest';
import { chunkSection, CHUNK_TARGET_CHARS, htmlToText, parseAct } from '../pipeline/lib/corpus';

const SAMPLE = `
<h1 class="part"><span>Part 1</span> Application of Act</h1>
<div class="prov" id="DLM94282">
  <h5 class="prov"><span class="label">1</span> Short Title and commencement</h5>
  <div class="prov-body">
    <div class="subprov"><p class="subprov"><span class="label">(1)</span></p>
      <div class="para"><p class="text">This Act may be cited as the Residential Tenancies Act 1986.</p></div>
    </div>
  </div>
</div>
<h2 class="part"><span>Part 2</span> Tenancy agreements</h2>
<div class="prov" id="DLM95000">
  <h5 class="prov"><span class="label">13A</span> Contents of tenancy agreement</h5>
  <div class="prov-body"><div class="para"><p class="text">Every tenancy agreement shall specify the bond &amp; the rent.</p></div></div>
</div>
<div class="prov" id="DLM95001">
  <h5 class="prov"><span class="label">14</span> Repealed section</h5>
  <div class="prov-body"></div>
</div>
<div class="prov" id="DLM99999">
  <h5 class="prov"><span class="label">Schedule 1AA</span> Savings provisions</h5>
  <div class="prov-body"><div class="para"><p class="text">Schedule content ignored.</p></div></div>
</div>
`;

describe('htmlToText', () => {
  it('strips tags, decodes entities and normalises whitespace', () => {
    expect(htmlToText('<p class="text">Bond &amp; rent</p>  <p>next</p>')).toBe(
      'Bond & rent\nnext',
    );
  });
});

describe('parseAct', () => {
  it('extracts sections with part context and skips non-sections', () => {
    const sections = parseAct(SAMPLE);

    expect(sections.map((s) => s.id)).toEqual(['1', '13A']);
    expect(sections[0]).toMatchObject({
      id: '1',
      heading: 'Short Title and commencement',
      part: 'Part 1 Application of Act',
    });
    expect(sections[0]?.text).toContain('cited as the Residential Tenancies Act 1986');
    expect(sections[0]?.text).toContain('(1)');
    expect(sections[1]).toMatchObject({
      id: '13A',
      part: 'Part 2 Tenancy agreements',
    });
    expect(sections[1]?.text).toContain('bond & the rent');
  });

  it('stops at the first schedule so amendment provisions never collide', () => {
    const withSchedule =
      SAMPLE +
      '<h2 class="schedule">Schedule 1AA</h2>' +
      '<div class="prov" id="DLM77777"><h5 class="prov"><span class="label">1</span> Amendment provision</h5>' +
      '<div class="prov-body"><div class="para"><p class="text">Would collide with s 1.</p></div></div></div>';
    const ids = parseAct(withSchedule).map((s) => s.id);
    expect(ids).toEqual(['1', '13A']);
  });

  it('skips prov blocks without a section heading', () => {
    const noHeading = '<div class="prov" id="DLM11111"><p>cross heading only</p></div>' + SAMPLE;
    expect(parseAct(noHeading).map((s) => s.id)).toEqual(['1', '13A']);
  });

  it('drops repealed sections with empty bodies', () => {
    const ids = parseAct(SAMPLE).map((s) => s.id);
    expect(ids).not.toContain('14');
  });
});

describe('chunkSection', () => {
  const base = {
    id: '23',
    heading: 'Bond payable',
    part: 'Part 2 Tenancy agreements',
  };

  it('emits a heading chunk plus one body chunk for a short section', () => {
    const chunks = chunkSection({ ...base, text: 'The bond shall not exceed 4 weeks rent.' });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ index: -1 });
    expect(chunks[0]?.text).toContain('s 23 Bond payable');
    expect(chunks[0]?.text).toContain('Part 2 Tenancy agreements');
    expect(chunks[1]?.text).toContain('4 weeks rent');
    expect(chunks[1]?.index).toBe(0);
  });

  it('splits long sections on paragraph boundaries and repeats the prefix', () => {
    const paragraph = 'A long provision about bonds. '.repeat(30).trim();
    const text = [paragraph, paragraph, paragraph].join('\n');
    const chunks = chunkSection({ ...base, text });

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.text).toContain('s 23 Bond payable');
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS + 200);
      expect(chunk.sectionId).toBe('23');
    }
    expect(chunks.map((c) => c.index)).toEqual([-1, 0, 1, 2]);
  });
});
